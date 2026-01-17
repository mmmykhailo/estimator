import { signInAnonymously } from "firebase/auth";
import { Plus, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import {
	useActionData,
	useNavigate,
	useNavigation,
	useSubmit,
} from "react-router";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { auth } from "~/lib/firebase/config";
import { createRoom } from "~/lib/firebase/operations";
import { createRoomCode } from "~/lib/utils/room-code";
import type { Task, Workstream } from "~/types/room";
import type { Route } from "./+types/create";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Create Room - Estimation" },
		{ name: "description", content: "Create a new estimation room" },
	];
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
	// Ensure user is authenticated before they can create a room
	if (!auth.currentUser) {
		await signInAnonymously(auth);
	}
	return null;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const roomCode = formData.get("roomCode") as string;
	const workstreamsJson = formData.get("workstreams") as string;
	const tasksJson = formData.get("tasks") as string;

	const workstreams = JSON.parse(workstreamsJson) as Omit<
		Workstream,
		"order"
	>[];
	const tasks = JSON.parse(tasksJson) as Omit<Task, "order">[];

	try {
		await createRoom(roomCode, workstreams, tasks);
		return { success: true, roomCode };
	} catch (error) {
		console.error("Failed to create room:", error);
		return {
			error: error instanceof Error ? error.message : "Failed to create room",
		};
	}
}

export default function CreateRoom() {
	const navigate = useNavigate();
	const submit = useSubmit();
	const navigation = useNavigation();
	const actionData = useActionData<typeof clientAction>();
	const [workstreams, setWorkstreams] = useState<Omit<Workstream, "order">[]>([
		{ id: nanoid(), name: "" },
	]);
	const [tasks, setTasks] = useState<Omit<Task, "order">[]>([
		{ id: nanoid(), title: "", link: "" },
	]);
	const [errors, setErrors] = useState<{
		workstreams?: string;
		tasks?: string;
	}>({});
	const [includeWorkstreams, setIncludeWorkstreams] = useState(false);

	const isSubmitting = navigation.state === "submitting";

	// Navigate to room after successful creation
	useEffect(() => {
		if (actionData?.success && actionData.roomCode) {
			navigate(`/room/${actionData.roomCode}`);
		}
	}, [actionData, navigate]);

	// Show error if creation failed
	const creationError = actionData?.error;

	const addWorkstream = () => {
		setWorkstreams([...workstreams, { id: nanoid(), name: "" }]);
	};

	const removeWorkstream = (id: string) => {
		if (workstreams.length > 1) {
			setWorkstreams(workstreams.filter((ws) => ws.id !== id));
		}
	};

	const updateWorkstream = (id: string, name: string) => {
		setWorkstreams(
			workstreams.map((ws) => (ws.id === id ? { ...ws, name } : ws)),
		);
		setErrors({ ...errors, workstreams: undefined });
	};

	const addTask = () => {
		setTasks([...tasks, { id: nanoid(), title: "", link: "" }]);
	};

	const removeTask = (id: string) => {
		if (tasks.length > 1) {
			setTasks(tasks.filter((t) => t.id !== id));
		}
	};

	const updateTask = (id: string, field: "title" | "link", value: string) => {
		setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
		setErrors({ ...errors, tasks: undefined });
	};

	const validateForm = (): boolean => {
		const newErrors: { workstreams?: string; tasks?: string } = {};

		// Validate workstreams only if enabled
		if (includeWorkstreams) {
			const filledWorkstreams = workstreams.filter(
				(ws) => ws.name.trim() !== "",
			);
			if (filledWorkstreams.length === 0) {
				newErrors.workstreams = "Add at least one workstream";
			}
		}

		// Validate tasks
		const filledTasks = tasks.filter((t) => t.title.trim() !== "");
		if (filledTasks.length === 0) {
			newErrors.tasks = "Add at least one task";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleCreateRoom = () => {
		if (!validateForm()) {
			return;
		}

		// Filter out empty entries
		const validWorkstreams = includeWorkstreams
			? workstreams.filter((ws) => ws.name.trim() !== "")
			: [];
		const validTasks = tasks
			.filter((t) => t.title.trim() !== "")
			.map((t) => ({
				...t,
				link: t.link?.trim() || undefined,
			}));

		// Generate room code
		const roomCode = createRoomCode();

		// Submit to action
		const formData = new FormData();
		formData.append("roomCode", roomCode);
		formData.append("workstreams", JSON.stringify(validWorkstreams));
		formData.append("tasks", JSON.stringify(validTasks));

		submit(formData, { method: "post" });
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="space-y-2 mb-8">
					<h1 className="text-4xl font-bold">Create Estimation Room</h1>
					<p className="text-muted-foreground">
						Define tasks for your estimation session
					</p>
				</div>

				<div className="grid lg:grid-cols-3 gap-6">
					{/* Left Column: Workstreams and Tasks */}
					<div className="lg:col-span-2 space-y-6">
						{/* Tasks Section */}
						<Card>
							<CardHeader>
								<CardTitle>Tasks</CardTitle>
								<CardDescription>
									Tasks to be estimated during the session
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-4 max-h-96 overflow-y-auto pr-2">
									{tasks.map((task, index) => (
										<div
											key={task.id}
											className="space-y-2 p-3 border rounded-lg"
										>
											<div className="flex gap-2">
												<span className="text-sm font-medium text-muted-foreground">
													#{index + 1}
												</span>
												<div className="flex-1 space-y-2">
													<div>
														<Label
															htmlFor={`task-title-${task.id}`}
															className="sr-only"
														>
															Task {index + 1} Title
														</Label>
														<Input
															id={`task-title-${task.id}`}
															placeholder="Task title"
															value={task.title}
															onChange={(e) =>
																updateTask(task.id, "title", e.target.value)
															}
														/>
													</div>
													<div>
														<Label
															htmlFor={`task-link-${task.id}`}
															className="sr-only"
														>
															Task {index + 1} Link
														</Label>
														<Input
															id={`task-link-${task.id}`}
															placeholder="Link (optional)"
															value={task.link}
															onChange={(e) =>
																updateTask(task.id, "link", e.target.value)
															}
														/>
													</div>
												</div>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => removeTask(task.id)}
													disabled={tasks.length === 1}
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>

								{errors.tasks && (
									<p className="text-sm text-destructive">{errors.tasks}</p>
								)}

								<Button
									variant="outline"
									size="sm"
									onClick={addTask}
									className="w-full"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Task
								</Button>
							</CardContent>
						</Card>

						{/* Workstreams Section - Now always visible with checkbox */}
						<Card>
							<CardHeader>
								<CardTitle>Workstreams</CardTitle>
								<CardDescription>
									Logical categories for estimation (e.g., Frontend, Backend,
									QA)
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center gap-3">
									<Checkbox
										id="workstreams-checkbox"
										checked={includeWorkstreams}
										onCheckedChange={(checked) =>
											setIncludeWorkstreams(checked === true)
										}
									/>
									<Label
										htmlFor="workstreams-checkbox"
										className="cursor-pointer"
									>
										Estimate multiple workstreams
									</Label>
								</div>
								{includeWorkstreams && (
									<div className="space-y-4 pt-2">
										<div className="space-y-3">
											{workstreams.map((ws, index) => (
												<div key={ws.id} className="flex gap-2">
													<div className="flex-1">
														<Label
															htmlFor={`workstream-${ws.id}`}
															className="sr-only"
														>
															Workstream {index + 1}
														</Label>
														<Input
															id={`workstream-${ws.id}`}
															placeholder={`Workstream ${index + 1}`}
															value={ws.name}
															onChange={(e) =>
																updateWorkstream(ws.id, e.target.value)
															}
														/>
													</div>
													<Button
														variant="ghost"
														size="icon"
														onClick={() => removeWorkstream(ws.id)}
														disabled={workstreams.length === 1}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>

										{errors.workstreams && (
											<p className="text-sm text-destructive">
												{errors.workstreams}
											</p>
										)}

										<Button
											variant="outline"
											size="sm"
											onClick={addWorkstream}
											className="w-full"
										>
											<Plus className="h-4 w-4 mr-2" />
											Add Workstream
										</Button>

										<Separator />

										<div className="text-sm text-muted-foreground space-y-2">
											<p className="font-medium">Note:</p>
											<p>
												Participants can estimate for any workstream, regardless
												of their role.
											</p>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Right Column: CTA */}
					<div className="space-y-6">
						{/* Actions Card */}
						<Card>
							<CardHeader>
								<CardTitle>Ready?</CardTitle>

								<div className="text-sm text-muted-foreground space-y-2">
									<p>A unique room code will be generated.</p>
									<p>Share it with participants to join.</p>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								{creationError && (
									<p className="text-sm text-destructive">{creationError}</p>
								)}
								<div className="space-y-2">
									<Button
										onClick={handleCreateRoom}
										className="w-full"
										size="lg"
										disabled={isSubmitting}
									>
										{isSubmitting ? "Creating..." : "Create Room"}
									</Button>
									<Button
										variant="outline"
										onClick={() => navigate("/")}
										className="w-full"
										size="lg"
										disabled={isSubmitting}
									>
										Cancel
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
