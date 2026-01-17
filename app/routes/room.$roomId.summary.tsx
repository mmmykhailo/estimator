import type { Route } from "./+types/room.$roomId.summary";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useNavigate } from "react-router";
import { Download, Home, CheckCircle2 } from "lucide-react";
import { useFirebaseRoom, useTasks, useAllEstimates } from "~/lib/room/hooks";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Session Ended - Estimation" }];
}

export default function SessionEnded() {
  const { roomId } = useFirebaseRoom();
  const navigate = useNavigate();
  const tasks = useTasks(roomId);
  const estimates = useAllEstimates(roomId);

  const downloadResults = () => {
    // Generate markdown content
    let markdown = `# Estimation Results\n\n`;
    markdown += `**Room ID:** \`${roomId}\`\n`;
    markdown += `**Date:** ${new Date().toLocaleString()}\n\n`;

    markdown += `## Tasks Estimated\n\n`;
    tasks.forEach((task, index) => {
      markdown += `### ${index + 1}. ${task.title}\n`;
      if (task.link) {
        markdown += `[Link](${task.link})\n`;
      }

      const taskEstimates = estimates.filter((e) => e.task_id === task.id);
      if (taskEstimates.length > 0) {
        markdown += `\n**Estimates:**\n`;
        taskEstimates.forEach((estimate) => {
          markdown += `- ${estimate.participant_name}: `;
          const values = Object.values(estimate.workstreams).map(
            (ws) => ws.value,
          );
          markdown += values.join(", ");
          markdown += `\n`;
        });
      }
      markdown += `\n`;
    });

    // Create blob and download
    const element = document.createElement("a");
    const file = new Blob([markdown], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `estimation-results-${roomId}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Success Message */}
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500 text-white">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-3xl">Session Complete</CardTitle>
            <CardDescription className="text-lg text-green-700 dark:text-green-300">
              Thank you for participating in the estimation session!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"} were
                estimated
              </p>
              <Badge variant="secondary" className="text-base">
                {estimates.length} total estimates
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              The session has ended and all results have been collected.
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={downloadResults} className="w-full" size="lg">
              <Download className="h-5 w-5 mr-2" />
              Download Results (Markdown)
            </Button>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Home className="h-5 w-5 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
