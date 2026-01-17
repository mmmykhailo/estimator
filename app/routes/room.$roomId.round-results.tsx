import type { Route } from "./+types/room.$roomId.round-results";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import {
  useFirebaseRoom,
  useWorkstreams,
  useLastCompletedRound,
  useParticipants,
  useIsOrganizer,
  useTasks,
  useCurrentTask,
  useRoomMetadata,
} from "~/lib/room/hooks";
import { advanceToNextTask, updateRoomStatus } from "~/lib/firebase/operations";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Results - Estimation" }];
}

export default function Results() {
  const { roomId, userId } = useFirebaseRoom();
  const workstreams = useWorkstreams(roomId);
  const lastRound = useLastCompletedRound(roomId);
  const participants = useParticipants(roomId);
  const isOrganizer = useIsOrganizer(roomId, userId);
  const tasks = useTasks(roomId);
  const currentTask = useCurrentTask(roomId);
  const metadata = useRoomMetadata(roomId);

  const currentTaskIndex = metadata?.current_task_index || 0;

  const handleNextTask = async () => {
    try {
      const hasNext = await advanceToNextTask(roomId);
      if (!hasNext) {
        // No more tasks
        await updateRoomStatus(roomId, "ended");
      }
    } catch (err) {
      console.error("Failed to advance to next task:", err);
    }
  };

  const handleEndSession = async () => {
    try {
      await updateRoomStatus(roomId, "ended");
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  };

  const shouldShowWorkstreamSection = workstreams.length > 1;
  const resultsTitle = shouldShowWorkstreamSection
    ? "Results by Workstream"
    : "Results";

  if (!lastRound) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No results available</p>
      </div>
    );
  }

  const task = tasks.find((t) => t.id === lastRound.task_id);
  const hasMoreTasks = currentTaskIndex < tasks.length - 1;

  // Calculate statistics per workstream
  const getWorkstreamStats = (workstreamId: string) => {
    const estimates: number[] = [];

    Object.entries(lastRound.estimates).forEach(([participantId, data]) => {
      const estimate = data.workstreams[workstreamId];
      if (estimate && estimate.value !== "?") {
        estimates.push(estimate.value as number);
      }
    });

    if (estimates.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const min = Math.min(...estimates);
    const max = Math.max(...estimates);
    const avg = estimates.reduce((a, b) => a + b, 0) / estimates.length;

    return { min, max, avg, count: estimates.length };
  };

  return (
    <div className="space-y-6">
      {/* Task Summary - Full Width */}
      <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <CardDescription className="text-green-700 dark:text-green-300">
                Estimation Complete
              </CardDescription>
              <CardTitle className="text-2xl">
                {task?.title || "Task"}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content - Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Results - Wide */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{resultsTitle}</h2>
            <Badge variant="outline">
              {Object.keys(lastRound.estimates).length} participants
            </Badge>
          </div>

          {shouldShowWorkstreamSection ? (
            // Multiple workstreams - show by workstream
            workstreams.map((workstream) => {
              const stats = getWorkstreamStats(workstream.id);

              if (stats.count === 0) {
                return null;
              }

              return (
                <Card key={workstream.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle>{workstream.name}</CardTitle>
                        <CardDescription>
                          {stats.count}{" "}
                          {stats.count === 1 ? "estimate" : "estimates"}
                        </CardDescription>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Min</p>
                          <p className="text-2xl font-bold">{stats.min}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg</p>
                          <p className="text-2xl font-bold">
                            {stats.avg.toFixed(1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Max</p>
                          <p className="text-2xl font-bold">{stats.max}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(lastRound.estimates)
                        .filter(([_, data]) => data.workstreams[workstream.id])
                        .map(([participantId, data]) => {
                          const participant = participants.find(
                            (p) => p.peer_id === participantId,
                          );
                          const estimate = data.workstreams[workstream.id];
                          const participantName =
                            data.participant_name ||
                            participant?.name ||
                            "Unknown";
                          const participantColor =
                            participant?.color || "bg-gray-500";

                          return (
                            <div
                              key={participantId}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                            >
                              <Avatar className="w-10 h-10">
                                <AvatarFallback className={participantColor}>
                                  {participantName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium">{participantName}</p>
                              </div>
                              <Badge
                                variant="default"
                                className="text-lg px-4 py-1"
                              >
                                {estimate.value}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            // No workstreams or single workstream - show flat list with "General workstream"
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle>General Workstream</CardTitle>
                    <CardDescription>
                      {Object.keys(lastRound.estimates).length} estimates
                    </CardDescription>
                  </div>
                  {workstreams.length === 1 &&
                    (() => {
                      const stats = getWorkstreamStats(workstreams[0].id);
                      return (
                        <div className="flex gap-4 text-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Min</p>
                            <p className="text-2xl font-bold">{stats.min}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg</p>
                            <p className="text-2xl font-bold">
                              {stats.avg.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Max</p>
                            <p className="text-2xl font-bold">{stats.max}</p>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </CardHeader>
              <Separator />
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(lastRound.estimates).map(
                    ([participantId, data]) => {
                      const participant = participants.find(
                        (p) => p.peer_id === participantId,
                      );
                      const participantName =
                        data.participant_name || participant?.name || "Unknown";
                      const participantColor =
                        participant?.color || "bg-gray-500";
                      // Use first workstream estimate or general value
                      const estimate =
                        workstreams.length === 1
                          ? data.workstreams[workstreams[0].id]
                          : Object.values(data.workstreams)[0];

                      if (!estimate) return null;

                      return (
                        <div
                          key={participantId}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className={participantColor}>
                              {participantName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{participantName}</p>
                          </div>
                          <Badge
                            variant="default"
                            className="text-lg px-4 py-1"
                          >
                            {estimate.value}
                          </Badge>
                        </div>
                      );
                    },
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Actions - Narrow */}
        <div className="space-y-4">
          {/* Show remaining tasks and heading for everyone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {hasMoreTasks ? "Continue" : "All Done"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-1">
                <p className="font-medium">
                  {hasMoreTasks
                    ? `${tasks.length - currentTaskIndex - 1} ${
                        tasks.length - currentTaskIndex - 1 === 1
                          ? "task"
                          : "tasks"
                      } remaining`
                    : "All tasks completed"}
                </p>
                {hasMoreTasks && (
                  <p className="text-muted-foreground">
                    {isOrganizer
                      ? "Continue to the next task or end the session"
                      : "Waiting for organizer to start the next task..."}
                  </p>
                )}
              </div>
              {isOrganizer && (
                <div className="space-y-2">
                  {hasMoreTasks && (
                    <Button onClick={handleNextTask} className="w-full">
                      Next Task
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleEndSession}
                    className="w-full"
                  >
                    {hasMoreTasks ? "End Session" : "Finish"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Thank You Message - Full Width (shown after session ends) */}
    </div>
  );
}
