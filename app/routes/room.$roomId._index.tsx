import type { Route } from "./+types/room.$roomId._index";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Play, Users, List, CheckSquare } from "lucide-react";
import { useFirebaseRoom, useWorkstreams, useTasks, useParticipants, useIsOrganizer } from "~/lib/room/hooks";
import { startRound } from "~/lib/firebase/operations";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Lobby - Estimation" }];
}

export default function Lobby() {
  const { roomId, peerId } = useFirebaseRoom();
  const workstreams = useWorkstreams(roomId);
  const tasks = useTasks(roomId);
  const participants = useParticipants(roomId);
  const isOrganizer = useIsOrganizer(roomId, peerId);

  const handleStartEstimation = async () => {
    try {
      // Start round with first task
      if (tasks.length > 0) {
        await startRound(roomId, tasks[0].id);
      }
    } catch (err) {
      console.error('Failed to start estimation:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Message */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Estimation Lobby</h2>
        <p className="text-muted-foreground">
          {isOrganizer
            ? "Start the estimation when everyone is ready"
            : "Waiting for the organizer to start the estimation"}
        </p>
      </div>

      <div className={`grid gap-6 ${workstreams.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {/* Participants */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Participants</CardTitle>
            </div>
            <CardDescription>{participants.length} connected</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="pr-4" style={{ maxHeight: '300px' }}>
              <div className="space-y-3">
                {participants.map((participant) => (
                  <div
                    key={participant.peer_id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={participant.color}>
                        {participant.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{participant.name}</p>
                      {participant.is_organizer && (
                        <Badge variant="secondary" className="text-xs">
                          Organizer
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Workstreams - Only show if there are any */}
        {workstreams.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Workstreams</CardTitle>
              </div>
              <CardDescription>{workstreams.length} defined</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="pr-4" style={{ maxHeight: '300px' }}>
                <div className="space-y-2">
                  {workstreams.map((workstream, index) => (
                    <div
                      key={workstream.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{workstream.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Tasks</CardTitle>
            </div>
            <CardDescription>{tasks.length} to estimate</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="pr-4" style={{ maxHeight: '300px' }}>
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border bg-card space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0">
                        #{index + 1}
                      </Badge>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-tight">{task.title}</p>
                        {task.link && (
                          <a
                            href={task.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline block truncate"
                          >
                            {task.link}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Start Button */}
      <Card>
        <CardContent className="pt-6">
          {isOrganizer ? (
            <div className="flex flex-col items-center gap-4">
              <Button
                size="lg"
                onClick={handleStartEstimation}
                className="w-full max-w-md"
                disabled={participants.length === 0}
              >
                <Play className="h-5 w-5 mr-2" />
                Start Estimation
              </Button>
              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Waiting for participants to join...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Waiting for the organizer to start the estimation session...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <span className="font-bold text-foreground">1.</span>
            <p>The organizer will start the estimation when ready</p>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-foreground">2.</span>
            <p>Each task will be estimated one at a time</p>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-foreground">3.</span>
            <p>You can estimate for any workstream using Fibonacci values</p>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-foreground">4.</span>
            <p>Click "I'm done" when you've finished estimating</p>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-foreground">5.</span>
            <p>Results will be revealed when everyone is done or organizer ends the round</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
