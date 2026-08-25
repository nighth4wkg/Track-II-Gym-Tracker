type WorkoutSetupStage = 1 | 2 | 3 | 4;

type WorkoutSetupStepsProps = {
  stage: WorkoutSetupStage;
  className: "welcome-start-steps" | "workout-start-steps";
};

const setupSteps = [
  { title: "Create a split", upcoming: "Start with a plan for today." },
  { title: "Add an exercise", upcoming: "Choose from the library." },
  { title: "Log your first set", upcoming: "Track weight, reps, and RIR." },
] as const;

function stepState(index: number, stage: WorkoutSetupStage) {
  if (index < stage) return "is-complete";
  if (index === stage) return "is-current";
  return "is-upcoming";
}

function stepDescription(index: number, stage: WorkoutSetupStage) {
  const stepNumber = index + 1;
  if (stepNumber < stage) return "Done";
  if (stepNumber === stage && stepNumber === 2) return "Search above or choose a quick pick.";
  if (stepNumber === stage && stepNumber === 3) return "Enter weight, reps, and RIR.";
  return setupSteps[index].upcoming;
}

export function WorkoutSetupSteps({ stage, className }: WorkoutSetupStepsProps) {
  return (
    <ol className={className} aria-label="Track II setup steps" aria-live="polite">
      {setupSteps.map((step, index) => {
        const state = stepState(index + 1, stage);
        return (
          <li className={state} key={step.title} aria-current={state === "is-current" ? "step" : undefined}>
            <span className="workout-start-step-index" aria-hidden="true">
              {state === "is-complete" ? "✓" : index + 1}
            </span>
            <span>
              <strong>{step.title}</strong>
              <small>{stepDescription(index, stage)}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
