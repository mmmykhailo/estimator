import { ref, set, update, get, push, serverTimestamp, remove } from 'firebase/database'
import { database } from './config'
import type {
  Workstream,
  Task,
  RoomStatus,
  FibonacciValue,
  Participant,
  RoomMetadata
} from '~/types/room'

/**
 * Check if a room exists in Firebase
 */
export async function checkRoomExists(roomId: string): Promise<boolean> {
  const roomRef = ref(database, `rooms/${roomId}/metadata`)
  const snapshot = await get(roomRef)
  return snapshot.exists()
}

/**
 * Create a new room with workstreams and tasks
 */
export async function createRoom(
  roomId: string,
  peerId: string,
  workstreams: Omit<Workstream, 'order'>[],
  tasks: Omit<Task, 'order'>[]
): Promise<void> {
  const roomRef = ref(database, `rooms/${roomId}`)

  // Prepare workstreams with order
  const workstreamsData: Record<string, Workstream> = {}
  workstreams.forEach((ws, index) => {
    workstreamsData[ws.id] = {
      ...ws,
      order: index
    }
  })

  // Prepare tasks with order
  const tasksData: Record<string, Task> = {}
  tasks.forEach((task, index) => {
    tasksData[task.id] = {
      id: task.id,
      title: task.title,
      order: index,
      // Only include link if it exists and is not empty
      ...(task.link && task.link.trim() !== '' ? { link: task.link } : {})
    }
  })

  // Create room structure
  await set(roomRef, {
    metadata: {
      created_at: serverTimestamp(),
      created_by: peerId,
      organizer_id: peerId,
      previous_organizer_id: null,
      status: 'lobby',
      current_task_index: 0,
      last_activity: serverTimestamp()
    },
    workstreams: workstreamsData,
    tasks: tasksData
  })
}

/**
 * Join an existing room
 */
export async function joinRoom(
  roomId: string,
  peerId: string,
  name: string,
  isOrganizer: boolean = false
): Promise<boolean> {
  // Check if room exists
  const exists = await checkRoomExists(roomId)
  if (!exists) return false

  // Check if room is in 'ended' status
  const metadataRef = ref(database, `rooms/${roomId}/metadata`)
  const metadataSnapshot = await get(metadataRef)
  const metadata = metadataSnapshot.val()
  
  if (metadata?.status === 'ended') {
    // Cannot join a session that has ended
    return false
  }

  // Add participant
  const participantRef = ref(database, `rooms/${roomId}/participants/${peerId}`)
  await set(participantRef, {
    peer_id: peerId,
    name,
    is_organizer: isOrganizer,
    color: generateColorFromPeerId(peerId),
    joined_at: serverTimestamp(),
    last_heartbeat: serverTimestamp(),
    connection_status: 'online'
  })

  // Update last activity
  await updateLastActivity(roomId)

  return true
}

/**
 * Leave a room (cleanup participant data)
 */
export async function leaveRoom(roomId: string, peerId: string): Promise<void> {
  const participantRef = ref(database, `rooms/${roomId}/participants/${peerId}`)
  await remove(participantRef)
}

/**
 * Update room status
 */
export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  const statusRef = ref(database, `rooms/${roomId}/metadata/status`)
  await set(statusRef, status)
  await updateLastActivity(roomId)
}

/**
 * Set organizer for the room
 */
export async function setOrganizer(
  roomId: string,
  newOrganizerId: string,
  storePrevious: boolean = false
): Promise<void> {
  const metadataRef = ref(database, `rooms/${roomId}/metadata`)

  if (storePrevious) {
    // Get current organizer first
    const snapshot = await get(metadataRef)
    const currentOrganizerId = snapshot.val()?.organizer_id

    await update(metadataRef, {
      organizer_id: newOrganizerId,
      previous_organizer_id: currentOrganizerId
    })
  } else {
    await update(metadataRef, {
      organizer_id: newOrganizerId
    })
  }

  await updateLastActivity(roomId)
}

/**
 * Clear previous organizer ID
 */
export async function clearPreviousOrganizer(roomId: string): Promise<void> {
  const prevOrganizerRef = ref(database, `rooms/${roomId}/metadata/previous_organizer_id`)
  await set(prevOrganizerRef, null)
}

/**
 * Start a new round for a task
 */
export async function startRound(roomId: string, taskId: string): Promise<void> {
  const currentRoundRef = ref(database, `rooms/${roomId}/current_round`)

  await set(currentRoundRef, {
    task_id: taskId,
    started_at: serverTimestamp(),
    estimates: {}
  })

  await updateRoomStatus(roomId, 'active')
}

/**
 * Submit an estimate for a workstream
 */
export async function submitEstimate(
  roomId: string,
  participantId: string,
  workstreamId: string,
  value: FibonacciValue
): Promise<void> {
  const estimateRef = ref(
    database,
    `rooms/${roomId}/current_round/estimates/${participantId}/workstreams/${workstreamId}`
  )

  await set(estimateRef, {
    value,
    submitted_at: serverTimestamp()
  })

  await updateLastActivity(roomId)
}

/**
 * Mark participant as done or not done
 */
export async function markParticipantDone(
  roomId: string,
  participantId: string,
  isDone: boolean
): Promise<void> {
  const participantEstimateRef = ref(
    database,
    `rooms/${roomId}/current_round/estimates/${participantId}`
  )

  await update(participantEstimateRef, {
    is_done: isDone,
    done_at: isDone ? serverTimestamp() : null
  })

  await updateLastActivity(roomId)
}

/**
 * End the current round and move it to completed rounds
 */
export async function endRound(roomId: string): Promise<void> {
  // Get current round data
  const currentRoundRef = ref(database, `rooms/${roomId}/current_round`)
  const currentRoundSnapshot = await get(currentRoundRef)

  if (!currentRoundSnapshot.exists()) {
    throw new Error('No active round to end')
  }

  const currentRound = currentRoundSnapshot.val()

  // Get participants data for denormalization
  const participantsRef = ref(database, `rooms/${roomId}/participants`)
  const participantsSnapshot = await get(participantsRef)
  const participants = participantsSnapshot.val() || {}

  // Get workstreams data for denormalization
  const workstreamsRef = ref(database, `rooms/${roomId}/workstreams`)
  const workstreamsSnapshot = await get(workstreamsRef)
  const workstreams = workstreamsSnapshot.val() || {}

  // Transform estimates to include denormalized names
  const completedEstimates: Record<string, any> = {}

  Object.entries(currentRound.estimates || {}).forEach(([participantId, estimate]: [string, any]) => {
    const participant = participants[participantId]
    const participantName = participant?.name || 'Unknown'

    // Transform workstream estimates to include workstream names
    const workstreamEstimates: Record<string, any> = {}
    Object.entries(estimate.workstreams || {}).forEach(([workstreamId, wsEstimate]: [string, any]) => {
      const workstream = workstreams[workstreamId]
      workstreamEstimates[workstreamId] = {
        ...wsEstimate,
        workstream_name: workstream?.name || 'Unknown'
      }
    })

    completedEstimates[participantId] = {
      participant_name: participantName,
      workstreams: workstreamEstimates,
      is_done: estimate.is_done || false,
      done_at: estimate.done_at || null
    }
  })

  // Add to completed rounds
  const completedRoundsRef = ref(database, `rooms/${roomId}/completed_rounds`)
  await push(completedRoundsRef, {
    task_id: currentRound.task_id,
    started_at: currentRound.started_at,
    completed_at: serverTimestamp(),
    estimates: completedEstimates
  })

  // Clear current round
  await remove(currentRoundRef)

  // Update status to results
  await updateRoomStatus(roomId, 'results')
}

/**
 * Advance to the next task
 * Returns true if advanced, false if no more tasks
 */
export async function advanceToNextTask(roomId: string): Promise<boolean> {
  const metadataRef = ref(database, `rooms/${roomId}/metadata`)
  const tasksRef = ref(database, `rooms/${roomId}/tasks`)

  // Get current task index and tasks
  const metadataSnapshot = await get(metadataRef)
  const tasksSnapshot = await get(tasksRef)

  const metadata = metadataSnapshot.val()
  const tasks = tasksSnapshot.val() || {}
  const taskCount = Object.keys(tasks).length

  const currentIndex = metadata?.current_task_index || 0
  const nextIndex = currentIndex + 1

  if (nextIndex >= taskCount) {
    // No more tasks, end session
    await updateRoomStatus(roomId, 'ended')
    return false
  }

  // Advance to next task
  await update(metadataRef, {
    current_task_index: nextIndex
  })

  // Get next task ID
  const nextTask = Object.values(tasks).find((task: any) => task.order === nextIndex) as Task

  if (nextTask) {
    // Start new round
    await startRound(roomId, nextTask.id)
    return true
  }

  return false
}

/**
 * Update participant data
 */
export async function updateParticipant(
  roomId: string,
  participantId: string,
  updates: Partial<Participant>
): Promise<void> {
  const participantRef = ref(database, `rooms/${roomId}/participants/${participantId}`)
  await update(participantRef, updates)
}

/**
 * Remove a participant from the room
 */
export async function removeParticipant(roomId: string, participantId: string): Promise<void> {
  const participantRef = ref(database, `rooms/${roomId}/participants/${participantId}`)
  await remove(participantRef)
}

/**
 * Get all active participants in a room
 */
export async function getActiveParticipants(roomId: string): Promise<Participant[]> {
  const participantsRef = ref(database, `rooms/${roomId}/participants`)
  const snapshot = await get(participantsRef)

  if (!snapshot.exists()) return []

  const participants = snapshot.val()
  return Object.values(participants) as Participant[]
}

/**
 * Get room metadata
 */
export async function getRoomMetadata(roomId: string): Promise<RoomMetadata | null> {
  const metadataRef = ref(database, `rooms/${roomId}/metadata`)
  const snapshot = await get(metadataRef)

  if (!snapshot.exists()) return null

  return snapshot.val() as RoomMetadata
}

/**
 * Update last activity timestamp
 */
async function updateLastActivity(roomId: string): Promise<void> {
  const lastActivityRef = ref(database, `rooms/${roomId}/metadata/last_activity`)
  await set(lastActivityRef, serverTimestamp())
}

/**
 * Generate a consistent color from peer ID
 */
function generateColorFromPeerId(peerId: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500'
  ]

  // Simple hash function
  let hash = 0
  for (let i = 0; i < peerId.length; i++) {
    hash = peerId.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}
