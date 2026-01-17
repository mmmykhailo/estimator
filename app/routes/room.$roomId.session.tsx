import type { Route } from "./+types/room.$roomId.session";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { Check, ExternalLink, Users } from "lucide-react";
import {
  useFirebaseRoom,
  useCurrentTask,
  useWorkstreams,
  useCurrentRound,
  useParticipants,
  useIsOrganizer,
  useAllParticipantsDone,
  useTasks,
} from "~/lib/room/hooks";
import {
  submitEstimate,
  markParticipantDone,
  endRound,
} from "~/lib/firebase/operations";
import { FIBONACCI_VALUES, type FibonacciValue } from "~/types/room";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Estimation Session - Estimation" }];
}

export default function EstimationSession() {
  const { roomId, userId } = useFirebaseRoom();
  const currentTask = useCurrentTask(roomId);
  const workstreams = useWorkstreams(roomId);
  const currentRound = useCurrentRound(roomId);
  const participants = useParticipants(roomId);
  const isOrganizer = useIsOrganizer(roomId, userId);
  const allDone = useAllParticipantsDone(roomId);
  const tasks = useTasks(roomId);

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
      ([workstreamId, estimate]: [string, any]) => {
        estimates.set(workstreamId, estimate.value);
      },
    );

    setMyEstimates(estimates);
    setIsDone(myData.is_done || false);

    if (Object.keys(myData.workstreams).length === 0) {
      setSelectedWorkstream("general");
    }
  }, [currentRound, userId]);

  // Auto-end round when all done
  useEffect(() => {
    if (allDone && isOrganizer) {
      // Small delay to allow UI to update
      setTimeout(() => {
        endRound(roomId).catch(console.error);
      }, 500);
    }
  }, [allDone, isOrganizer, roomId]);

  const handleEstimate = async (
    workstreamId: string,
    value: FibonacciValue,
  ) => {
    try {
      await submitEstimate(roomId, workstreamId, value);
      setMyEstimates(new Map(myEstimates).set(workstreamId, value));
    } catch (err) {
      console.error("Failed to submit estimate:", err);
    }
  };

  const handleToggleDone = async () => {
    try {
      const newDone = !isDone;
      await markParticipantDone(roomId, newDone);
      setIsDone(newDone);
    } catch (err) {
      console.error("Failed to mark as done:", err);
    }
  };

  const handleEndRound = async () => {
    try {
      await endRound(roomId);
    } catch (err) {
      console.error("Failed to end round:", err);
    }
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
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
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
          {workstreams.length > 0 && (
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
                    <div
                      key={workstream.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
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
                                    key={p!.peer_id}
                                    className="border-2 border-background w-6 h-6"
                                  >
                                    <AvatarFallback
                                      className={`${p!.color} text-xs`}
                                    >
                                      {p!.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Fibonacci Estimate Buttons */}
          {selectedWorkstream && (
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
                        className="text-xl font-bold min-w-[4rem] h-16"
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
                    className="text-xl font-bold min-w-[4rem] h-16"
                    onClick={() => handleEstimate(selectedWorkstream, "?")}
                  >
                    ?
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Participants Status */}
        {!!participants && (
          <div className="space-y-4">
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
                  disabled={!hasAnyEstimate}
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
