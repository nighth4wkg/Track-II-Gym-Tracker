import { useCallback, type Dispatch, type SetStateAction } from "react";
import { supabase } from "../supabase";
import { TRACK_LIMITS } from "../trackConstants";
import type { AiExercise, Checklist, SetEntry, Task, WeightUnit } from "../trackTypes";
import type { WorkoutTaskUpdater } from "./useWorkoutState";

type UseWorkoutImportActionsOptions = {
  active?: Checklist;
  aiKey: string;
  aiExercises: AiExercise[];
  defaultUnit: WeightUnit;
  setAiError: Dispatch<SetStateAction<string>>;
  setAiExercises: Dispatch<SetStateAction<AiExercise[]>>;
  setAiBusy: Dispatch<SetStateAction<boolean>>;
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
  setShowTimer: Dispatch<SetStateAction<boolean>>;
  setShowCalendar: Dispatch<SetStateAction<boolean>>;
  setShowRank: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  updateTasks: WorkoutTaskUpdater;
};

export function useWorkoutImportActions({
  active,
  aiKey,
  aiExercises,
  defaultUnit,
  setAiError,
  setAiExercises,
  setAiBusy,
  setLists,
  setActiveId,
  setShowTimer,
  setShowCalendar,
  setShowRank,
  setSettingsOpen,
  updateTasks,
}: UseWorkoutImportActionsOptions) {
  const importWorkoutImage = useCallback(
    async (file?: File) => {
      setAiError("");
      setAiExercises([]);
      if (!file) return;
      if (!aiKey.trim()) {
        setAiError("Enter your Gemini API key first.");
        return;
      }
      if (!file.type.startsWith("image/") || file.size > TRACK_LIMITS.maxAiImageBytes) {
        setAiError("Choose a JPG, PNG, or HEIC image smaller than 8 MB.");
        return;
      }
      setAiBusy(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read"));
          reader.readAsDataURL(file);
        });
        const imageBase64 = dataUrl.split(",")[1];
        const { data, error } = await supabase.functions.invoke("extract-workout", {
          body: { apiKey: aiKey.trim(), imageBase64, mimeType: file.type },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Import failed");
        if (!Array.isArray(data?.exercises) || data.exercises.length === 0)
          throw new Error("We couldn't identify exercises in this image. Try a clearer or closer photo.");
        setAiExercises(data.exercises);
      } catch (error) {
        setAiError(error instanceof Error ? error.message : "We couldn't figure out what was in that image.");
      } finally {
        setAiBusy(false);
      }
    },
    [aiKey, setAiBusy, setAiError, setAiExercises],
  );

  const addAiExercises = useCallback(() => {
    if (!aiExercises.length) return;
    const importedTasks: Task[] = aiExercises.map((exercise) => ({
      id: crypto.randomUUID(),
      text: exercise.name.trim() || "Unknown exercise",
      reps: String(exercise.sets[0]?.reps ?? 1),
      rir: String(exercise.sets[0]?.rir ?? 0),
      done: false,
      collapsed: false,
      sets: (exercise.sets.length ? exercise.sets : [{ weight: 0, unit: defaultUnit, reps: 1, rir: 0 }]).map(
        (set): SetEntry => ({
          id: crypto.randomUUID(),
          weight: String(set.weight ?? 0),
          unit: set.unit === "lb" ? "lb" : "kg",
          reps: String(set.reps ?? 1),
          rir: String(set.rir ?? 0),
        }),
      ),
    }));
    if (active) {
      updateTasks((current) => [...current, ...importedTasks]);
    } else {
      const importedSplit: Checklist = {
        id: crypto.randomUUID(),
        title: "Imported workout",
        tasks: importedTasks,
        updatedAt: Date.now(),
      };
      setLists((current) => [...current, importedSplit]);
      setActiveId(importedSplit.id);
      setShowTimer(false);
      setShowCalendar(false);
      setShowRank(false);
    }
    setAiExercises([]);
    setSettingsOpen(false);
  }, [
    active,
    aiExercises,
    defaultUnit,
    setActiveId,
    setAiExercises,
    setLists,
    setSettingsOpen,
    setShowCalendar,
    setShowRank,
    setShowTimer,
    updateTasks,
  ]);

  return { addAiExercises, importWorkoutImage };
}
