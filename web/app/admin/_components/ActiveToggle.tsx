import { sv } from "../strings";
import { secondaryButtonClass } from "./ui";

/** Activate/deactivate button posting to a Server Action (items are never deleted). */
export function ActiveToggle({ id, active, action }: { id: string; active: boolean; action: (form: FormData) => Promise<void> }) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button type="submit" className={secondaryButtonClass}>
        {active ? sv.common.deactivate : sv.common.activate}
      </button>
    </form>
  );
}
