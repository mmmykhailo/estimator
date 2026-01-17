import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	isValidRoomCode,
	parseRoomCode,
	ROOM_CODE_LENGTH,
} from "~/lib/utils/room-code";
import type { Route } from "./+types/_index";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Task Estimation" },
		{ name: "description", content: "Collaborative task estimation tool" },
	];
}

export default function Home() {
	const navigate = useNavigate();
	const [roomCode, setRoomCode] = useState("");
	const [error, setError] = useState("");

	const handleJoinRoom = () => {
		const parsedCode = parseRoomCode(roomCode);

		if (!isValidRoomCode(parsedCode)) {
			setError(`Please enter a valid ${ROOM_CODE_LENGTH}-character room code`);
			return;
		}

		setError("");
		navigate(`/room/${parsedCode}`);
	};

	const handleRoomCodeChange = (value: string) => {
		setRoomCode(value);
		setError("");
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
			<div className="w-full max-w-4xl space-y-8">
				{/* Hero Section */}
				<div className="text-center space-y-4">
					<h1 className="text-5xl font-bold tracking-tight">Task Estimation</h1>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Collaborative task estimation with real-time synchronization. Work
						together with your team to estimate tasks in minutes.
					</p>
				</div>

				{/* Action Cards */}
				<div className="grid md:grid-cols-2 gap-6">
					{/* Create Room Card */}
					<Card className="border-2 hover:border-primary transition-colors">
						<CardHeader>
							<CardTitle>Create Room</CardTitle>
							<CardDescription>
								Start a new estimation session as the organizer
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild size="lg" className="w-full">
								<Link to="/create">Create New Room</Link>
							</Button>
							<div className="mt-4 text-sm text-muted-foreground space-y-2">
								<p>As organizer, you will:</p>
								<ul className="list-disc list-inside space-y-1">
									<li>Define workstreams</li>
									<li>Add tasks to estimate</li>
									<li>Control estimation rounds</li>
								</ul>
							</div>
						</CardContent>
					</Card>

					{/* Join Room Card */}
					<Card className="border-2 hover:border-primary transition-colors">
						<CardHeader>
							<CardTitle>Join Room</CardTitle>
							<CardDescription>
								Join an existing estimation session with a room code
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="roomCode">Room Code</Label>
								<Input
									id="roomCode"
									placeholder="e.g. A3X7K9JD"
									value={roomCode}
									onChange={(e) => handleRoomCodeChange(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
									className={error ? "border-destructive" : ""}
									maxLength={ROOM_CODE_LENGTH}
								/>
								{error && <p className="text-sm text-destructive">{error}</p>}
							</div>
							<Button
								size="lg"
								className="w-full"
								onClick={handleJoinRoom}
								disabled={!roomCode.trim()}
							>
								Join Room
							</Button>
							<p className="text-sm text-muted-foreground">
								Enter the {ROOM_CODE_LENGTH}-character code shared by the
								organizer
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Features */}
				<div className="text-center text-sm text-muted-foreground space-y-2 pt-8 border-t">
					<p className="font-medium">Features</p>
					<div className="flex flex-wrap justify-center gap-4">
						<span>Real-time sync</span>
						<span>•</span>
						<span>Multi-workstream support</span>
						<span>•</span>
						<span>Fibonacci estimation</span>
						<span>•</span>
						<span>Easy to use</span>
					</div>
				</div>
			</div>
		</div>
	);
}
