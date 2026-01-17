import { Check, ExternalLink, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigation, useSubmit } from "react-router";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
	endRound,
	markParticipantDone,
	submitEstimate,
} from "~/lib/firebase/operations";
import {
	getCurrentRoundSnapshot,
	getMetadataSnapshot,
	getParticipantsSnapshot,
	getTasksSnapshot,
	getWorkstreamsSnapshot,
} from "~/lib/firebase/snapshots";
import {
	useAllParticipantsDone,
	useCurrentRound,
	useFirebaseRoom,
	useIsOrganizer,
	useParticipants,
	useRoomMetadata,
	useTasks,
	useWorkstreams,
} from "~/lib/room/hooks";
import { FIBONACCI_VALUES, type FibonacciValue } from "~/types/room";
import type { Route } from "./+types/room.$roomId.session";

export function meta(_args: Route.MetaArgs) {
	return [{ title: "Estimation Session - Estimation" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const roomId = params.roomId;

	const [metadata, participants, workstreams, tasks, currentRound] =
		await Promise.all([
			getMetadataSnapshot(roomId),
			getParticipantsSnapshot(roomId),
			getWorkstreamsSnapshot(roomId),
			getTasksSnapshot(roomId),
			getCurrentRoundSnapshot(roomId),
		]);

	// Compute current task from metadata and tasks
	const currentTask =
		metadata && tasks.length > 0
			? tasks.find((t) => t.order === metadata.current_task_index) || null
			: null;

	return {
		metadata,
		participants,
		workstreams,
		tasks,
		currentRound,
		currentTask,
	};
}

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const roomId = params.roomId;
	const formData = await request.formData();
	const actionType = formData.get("_action");

	try {
		switch (actionType) {
			case "submit-estimate": {
				const workstreamId = formData.get("workstreamId") as string;
				const valueStr = formData.get("value") as string;
				// Convert string to proper FibonacciValue type (number or "?")
				const value: FibonacciValue =
					valueStr === "?" ? "?" : (Number(valueStr) as FibonacciValue);
				await submitEstimate(roomId, workstreamId, value);
				return { success: true };
			}

			case "mark-done": {
				const isDone = formData.get("isDone") === "true";
				await markParticipantDone(roomId, isDone);
				return { success: true };
			}

			case "end-round": {
				await endRound(roomId);
				return { success: true };
			}

			default:
				return { error: "Unknown action" };
		}
	} catch (error) {
		console.error("Action error:", error);
		return {
			error: error instanceof Error ? error.message : "An error occurred",
		};
	}
}

export default function EstimationSession() {
	const loaderData = useLoaderData<typeof clientLoader>();
	const { roomId, userId } = useFirebaseRoom();

	// Use loader data as initial values, hooks subscribe for real-time updates
	const metadata = useRoomMetadata(roomId, loaderData.metadata);
	const workstreams = useWorkstreams(roomId, loaderData.workstreams);
	const tasks = useTasks(roomId, loaderData.tasks);
	const currentRound = useCurrentRound(roomId, loaderData.currentRound);
	const participants = useParticipants(roomId, loaderData.participants);
	const isOrganizer = useIsOrganizer(roomId, userId);
	const allDone = useAllParticipantsDone(roomId);

	// Compute current task from metadata and tasks
	const currentTask =
		metadata && tasks.length > 0
			? tasks.find((t) => t.order === metadata.current_task_index) || null
			: null;

	const submit = useSubmit();
	const navigation = useNavigation();

	const isSubmitting = navigation.state === "submitting";

	const [selectedWorkstream, setSelectedWorkstream] = useState<string | null>(
		null,
	);
	const [myEstimates, setMyEstimates] = useState<Map<string, FibonacciValue>>(
		new Map(),
	);
	const [isDone, setIsDone] = useState(false);

	// Sync my estimates from Firebase
	useEffect(() => {
		if (!currentRound || !userId) return;

		const myData = currentRound.estimates[userId];
		if (!myData) return;

		const estimates = new Map<string, FibonacciValue>();
		Object.entries(myData.workstreams || {}).forEach(
			([workstreamId, estimate]) => {
				const est = estimate as { value: FibonacciValue };
				// Convert string values to numbers (except "?")
				const rawValue = est.value;
				const value: FibonacciValue =
					rawValue === "?"
						? "?"
						: typeof rawValue === "string"
							? (Number(rawValue) as FibonacciValue)
							: rawValue;
				estimates.set(workstreamId, value);
			},
		);

		setMyEstimates(estimates);
		setIsDone(myData.is_done || false);
	}, [currentRound, userId]);

	useEffect(() => {
		if (workstreams.length < 2) {
			setSelectedWorkstream(workstreams[0]?.id || "general");
		}
	}, [workstreams]);

	// Auto-end round when all done
	useEffect(() => {
		if (allDone && isOrganizer && !isSubmitting) {
			// Small delay to allow UI to update
			setTimeout(() => {
				const formData = new FormData();
				formData.append("_action", "end-round");
				submit(formData, { method: "post" });
			}, 500);
		}
	}, [allDone, isOrganizer, isSubmitting, submit]);

	const handleEstimate = (workstreamId: string, value: FibonacciValue) => {
		const formData = new FormData();
		formData.append("_action", "submit-estimate");
		formData.append("workstreamId", workstreamId);
		formData.append("value", String(value));
		submit(formData, { method: "post" });
		// Optimistic update
		setMyEstimates(new Map(myEstimates).set(workstreamId, value));
	};

	const handleToggleDone = () => {
		const newDone = !isDone;
		const formData = new FormData();
		formData.append("_action", "mark-done");
		formData.append("isDone", String(newDone));
		submit(formData, { method: "post" });
		// Optimistic update
		setIsDone(newDone);
	};

	const handleEndRound = () => {
		const formData = new FormData();
		formData.append("_action", "end-round");
		submit(formData, { method: "post" });
	};

	const getWorkstreamSubmitters = (workstreamId: string): string[] => {
		if (!currentRound) return [];

		const submitters: string[] = [];
		Object.entries(currentRound.estimates).forEach(
			([participantId, participantData]) => {
				if (
					participantData.workstreams &&
					workstreamId in participantData.workstreams
				) {
					submitters.push(participantId);
				}
			},
		);

		return submitters;
	};

	const getDoneParticipants = (): string[] => {
		if (!currentRound) return [];

		const done: string[] = [];
		Object.entries(currentRound.estimates).forEach(
			([participantId, participantData]) => {
				if (participantData.is_done) {
					done.push(participantId);
				}
			},
		);

		return done;
	};

	const getCurrentTaskIndex = (): number => {
		if (!currentTask || !tasks.length) return 0;
		return currentTask.order;
	};

	if (!currentTask) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">No task available</p>
			</div>
		);
	}

	const doneParticipants = getDoneParticipants();
	const hasAnyEstimate = myEstimates.size > 0;

	return (
		<div className="max-w-5xl mx-auto space-y-6">
			{/* Current Task */}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 space-y-2">
							<CardDescription>Current Task</CardDescription>
							{currentTask.link ? (
								<a
									href={currentTask.link}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 text-primary hover:underline hover:text-primary/80"
								>
									<CardTitle className="text-2xl">
										{currentTask.title}
									</CardTitle>
									<ExternalLink className="h-4 w-4 shrink-0" />
								</a>
							) : (
								<CardTitle className="text-2xl">{currentTask.title}</CardTitle>
							)}
						</div>
						<div className="text-right">
							<p className="text-sm text-muted-foreground">Task Progress</p>
							<p className="text-2xl font-bold">
								{getCurrentTaskIndex() + 1} / {tasks.length}
							</p>
						</div>
					</div>
				</CardHeader>
			</Card>

			<div className="grid lg:grid-cols-3 gap-6">
				{/* Workstream Selection & Estimation */}
				<div className="lg:col-span-2 space-y-4">
					{/* Workstreams - Only show if there are any */}
					{workstreams.length > 1 && (
						<Card>
							<CardHeader>
								<CardTitle>Select Workstream to Estimate</CardTitle>
								<CardDescription>
									Click a workstream to provide your estimate
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{workstreams.map((workstream) => {
									const submitters = getWorkstreamSubmitters(workstream.id);
									const myEstimate = myEstimates.get(workstream.id);
									const submitterParticipants = submitters
										.map((id) => participants?.find((p) => p.peer_id === id))
										.filter(Boolean);

									return (
										<button
											type="button"
											key={workstream.id}
											className={`w-full text-left p-4 rounded-lg border-2 transition-all cursor-pointer ${
												selectedWorkstream === workstream.id
													? "border-primary bg-primary/5"
													: "border-border hover:border-primary/50"
											}`}
											onClick={() => setSelectedWorkstream(workstream.id)}
										>
											<div className="flex items-center justify-between gap-4">
												<div className="flex-1">
													<div className="flex items-center gap-2">
														<h3 className="font-semibold">{workstream.name}</h3>
														{myEstimate !== undefined && (
															<Badge variant="default">
																{myEstimate} points
															</Badge>
														)}
													</div>
													{submitterParticipants.length > 0 && (
														<div className="flex items-center gap-2 mt-2">
															<span className="text-xs text-muted-foreground">
																Submitted:
															</span>
															<div className="flex -space-x-2">
																{submitterParticipants.map((p) => (
																	<Avatar
																		key={p?.peer_id}
																		className="border-2 border-background w-6 h-6"
																	>
																		<AvatarFallback
																			className={`${p?.color} text-xs`}
																		>
																			{p?.name.charAt(0).toUpperCase()}
																		</AvatarFallback>
																	</Avatar>
																))}
															</div>
														</div>
													)}
												</div>
											</div>
										</button>
									);
								})}
							</CardContent>
						</Card>
					)}

					{/* Fibonacci Estimate Buttons */}
					{!!selectedWorkstream && (
						<Card>
							<CardHeader>
								<CardTitle>Your Estimate</CardTitle>
								<CardDescription>
									Select a Fibonacci value for{" "}
									{workstreams.length > 0
										? workstreams.find((w) => w.id === selectedWorkstream)?.name
										: "this task"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap gap-3">
									{FIBONACCI_VALUES.map((value) => {
										const isSelected =
											myEstimates.get(selectedWorkstream) === value;
										return (
											<Button
												key={value}
												variant={isSelected ? "default" : "outline"}
												size="lg"
												className="text-xl font-bold min-w-16 h-16"
												onClick={() =>
													handleEstimate(selectedWorkstream, value)
												}
											>
												{value}
											</Button>
										);
									})}
									{/* Unknown/Question Mark Option */}
									<Button
										variant={
											myEstimates.get(selectedWorkstream) === "?"
												? "default"
												: "outline"
										}
										size="lg"
										className="text-xl font-bold min-w-16 h-16"
										onClick={() => handleEstimate(selectedWorkstream, "?")}
									>
										?
									</Button>
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				{!!participants && (
					<div className="space-y-4">
						{/* Participants Status */}
						<Card>
							<CardHeader>
								<div className="flex items-center gap-2">
									<Users className="h-5 w-5 text-muted-foreground" />
									<CardTitle>Participants</CardTitle>
								</div>
								<CardDescription>
									{doneParticipants.length} / {participants.length} done
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{participants.map((participant) => {
									const participantDone = doneParticipants.includes(
										participant.peer_id,
									);
									const isMe = participant.peer_id === userId;

									return (
										<div
											key={participant.peer_id}
											className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
										>
											<Avatar className="w-8 h-8">
												<AvatarFallback className={participant.color}>
													{participant.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">
													{participant.name} {isMe && "(You)"}
												</p>
											</div>
											{participantDone && (
												<Check className="h-4 w-4 text-green-500" />
											)}
										</div>
									);
								})}
							</CardContent>
						</Card>

						{/* Actions */}
						<Card>
							<CardContent className="space-y-3">
								<Button
									variant={isDone ? "secondary" : "default"}
									className="w-full"
									onClick={handleToggleDone}
									disabled={!hasAnyEstimate || isSubmitting}
								>
									{isDone ? (
										<>
											<Check className="h-4 w-4 mr-2" />
											Mark as Not Done
										</>
									) : (
										"I'm Done"
									)}
								</Button>

								{!hasAnyEstimate && (
									<p className="text-xs text-muted-foreground text-center">
										Submit at least one estimate first
									</p>
								)}

								{isOrganizer && (
									<>
										<Separator />
										<Button
											variant="outline"
											className="w-full"
											onClick={handleEndRound}
											disabled={isSubmitting}
										>
											End Round
										</Button>
										{allDone && (
											<p className="text-xs text-green-600 text-center font-medium">
												All participants are done!
											</p>
										)}
									</>
								)}
							</CardContent>
						</Card>
					</div>
				)}
			</div>
		</div>
	);
}
