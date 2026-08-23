"use client";

import { useState } from "react";
import type { Checklist, Filter, Task } from "../trackTypes";

export function useWorkoutState() {
  const [lists, setLists] = useState<Checklist[]>([]);
  const [activeId, setActiveId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [splitMenu, setSplitMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [splitName, setSplitName] = useState("");
  const [homeTransition, setHomeTransition] = useState(false);
  const [progressFading, setProgressFading] = useState(false);
  const [workoutActionsExiting, setWorkoutActionsExiting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileExerciseMenu, setMobileExerciseMenu] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingSplit, setDraggingSplit] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return {
    lists,
    setLists,
    activeId,
    setActiveId,
    searchQuery,
    setSearchQuery,
    showSuggestions,
    setShowSuggestions,
    splitMenu,
    setSplitMenu,
    renamingId,
    setRenamingId,
    splitName,
    setSplitName,
    homeTransition,
    setHomeTransition,
    progressFading,
    setProgressFading,
    workoutActionsExiting,
    setWorkoutActionsExiting,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileExerciseMenu,
    setMobileExerciseMenu,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    filter,
    setFilter,
    dragging,
    setDragging,
    draggingSplit,
    setDraggingSplit,
    editing,
    setEditing,
    editValue,
    setEditValue,
  };
}

export type WorkoutState = ReturnType<typeof useWorkoutState>;

export type WorkoutTaskUpdater = (change: (current: Task[]) => Task[], marksWorkoutChanged?: boolean) => void;
