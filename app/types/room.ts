/**
 * Room status states
 */
export type RoomStatus = 'lobby' | 'active' | 'results' | 'ended'

/**
 * Fibonacci sequence values for estimation
 */
export const FIBONACCI_VALUES = [1, 2, 3, 5, 8, 13, 21] as const
export type FibonacciValue = typeof FIBONACCI_VALUES[number] | "?"

/**
 * Workstream (formerly Team) - logical category for estimates
 */
export interface Workstream {
  id: string
  name: string
  order: number
}

/**
 * Task to be estimated
 */
export interface Task {
  id: string
  title: string
  link?: string
  order: number
}

/**
 * Individual estimate for a workstream
 */
export interface Estimate {
  value: FibonacciValue
  submitted_at: number
}

/**
 * Participant's estimates for a single round
 */
export interface ParticipantEstimates {
  workstreams: Record<string, Estimate>  // workstreamId -> Estimate
  is_done: boolean
  done_at?: number
}

/**
 * Current estimation round
 */
export interface Round {
  task_id: string
  started_at: number
  estimates: Record<string, ParticipantEstimates>  // participantId -> ParticipantEstimates
}

/**
 * Completed round (historical data with denormalized names)
 */
export interface CompletedRound {
  task_id: string
  started_at: number
  completed_at: number
  estimates: Record<string, {
    participant_name: string  // Denormalized for history
    workstreams: Record<string, Estimate & { workstream_name: string }>  // Denormalized
    is_done: boolean
    done_at?: number
  }>
}

/**
 * Room metadata stored in Firebase
 */
export interface RoomMetadata {
  created_at: number
  created_by: string
  organizer_id: string
  previous_organizer_id?: string | null
  status: RoomStatus
  current_task_index: number
  last_activity: number
}

/**
 * Participant data stored in Firebase
 */
export interface Participant {
  peer_id: string
  name: string
  is_organizer: boolean
  color: string
  joined_at: number
  last_heartbeat: number
  connection_status: 'online' | 'offline'
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'
