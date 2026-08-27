"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { PersonalInfo, ReleaseSignal, TrackAnnouncement, UpdatesViewStatus } from "../trackTypes";
import { TRACK_UI_COPY } from "../trackConstants";

export function useIdentityState() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [usernamePromptOpen, setUsernamePromptOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [personalHeightInput, setPersonalHeightInput] = useState("");
  const [personalWeightInput, setPersonalWeightInput] = useState("");
  const [personalInfoPromptOpen, setPersonalInfoPromptOpen] = useState(false);
  const [personalInfoSaving, setPersonalInfoSaving] = useState(false);
  const [personalInfoMessage, setPersonalInfoMessage] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [exerciseNames, setExerciseNames] = useState<readonly string[]>([]);
  const [syncLabel, setSyncLabel] = useState<string>(TRACK_UI_COPY.status.saved);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);
  const [siteUpdateSeconds, setSiteUpdateSeconds] = useState<number | null>(null);
  const [updateReady, setUpdateReady] = useState<ReleaseSignal | null>(null);
  const [debugUpdateNotification, setDebugUpdateNotification] = useState(false);
  const [updatesViewBusy, setUpdatesViewBusy] = useState(false);
  const [updatesViewStatus, setUpdatesViewStatus] = useState<UpdatesViewStatus>("idle");
  const [updatesViewMessage, setUpdatesViewMessage] = useState("");
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [updateCheckBusy, setUpdateCheckBusy] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState("");
  const [availableUpdateVersion, setAvailableUpdateVersion] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<TrackAnnouncement | null>(null);
  const [announcementOffset, setAnnouncementOffset] = useState(0);

  return {
    user,
    setUser,
    authLoading,
    setAuthLoading,
    authMessage,
    setAuthMessage,
    usernamePromptOpen,
    setUsernamePromptOpen,
    usernameInput,
    setUsernameInput,
    usernameMessage,
    setUsernameMessage,
    usernameSaving,
    setUsernameSaving,
    personalInfo,
    setPersonalInfo,
    personalHeightInput,
    setPersonalHeightInput,
    personalWeightInput,
    setPersonalWeightInput,
    personalInfoPromptOpen,
    setPersonalInfoPromptOpen,
    personalInfoSaving,
    setPersonalInfoSaving,
    personalInfoMessage,
    setPersonalInfoMessage,
    cloudReady,
    setCloudReady,
    exerciseNames,
    setExerciseNames,
    syncLabel,
    setSyncLabel,
    lastSuccessfulSyncAt,
    setLastSuccessfulSyncAt,
    siteUpdateSeconds,
    setSiteUpdateSeconds,
    updateReady,
    setUpdateReady,
    debugUpdateNotification,
    setDebugUpdateNotification,
    updatesViewBusy,
    setUpdatesViewBusy,
    updatesViewStatus,
    setUpdatesViewStatus,
    updatesViewMessage,
    setUpdatesViewMessage,
    adminAuthorized,
    setAdminAuthorized,
    updateCheckBusy,
    setUpdateCheckBusy,
    updateCheckMessage,
    setUpdateCheckMessage,
    availableUpdateVersion,
    setAvailableUpdateVersion,
    announcement,
    setAnnouncement,
    announcementOffset,
    setAnnouncementOffset,
  };
}

export type IdentityState = ReturnType<typeof useIdentityState>;
