"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { Switch } from "@calcom/ui/components/form";
import { ArrowLeftIcon, RotateCwIcon } from "@coss/ui/icons";
import { showToast } from "@calcom/ui/components/toast";
import type { ICalendarSwitchProps } from "@calcom/ui/components/calendar-switch";

type UserCalendarSwitchProps = Omit<ICalendarSwitchProps, "eventTypeId">;

type EventCalendarSwitchProps = ICalendarSwitchProps & {
  eventTypeId: number;
};

const GROUP_EVENT = "calcom:calendar-switch-group-toggle";

type GroupToggleDetail = {
  groupId: string;
  uniqueId: string;
};

const CalendarSwitch = (props: ICalendarSwitchProps) => {
  const {
    isFree,
    title,
    externalId,
    type,
    isChecked,
    name,
    credentialId,
    delegationCredentialId,
    eventTypeId,
    disabled,
    groupId,
    uniqueId,
  } = props;

  const [checkedInternal, setCheckedInternal] = useState(isChecked);
  const checkedRef = useRef(checkedInternal);

  const utils = trpc.useUtils();
  const { t } = useLocale();

  useEffect(() => {
    checkedRef.current = checkedInternal;
  }, [checkedInternal]);

  const mutation = useMutation({
    mutationFn: async ({ isOn }: { isOn: boolean }) => {
      const body = {
        integration: type,
        externalId: externalId,
        ...(delegationCredentialId && { delegationCredentialId }),
        // new URLSearchParams does not accept numbers
        credentialId: String(credentialId),
        ...(eventTypeId ? { eventTypeId: String(eventTypeId) } : {}),
        free: isFree,
      };

      if (isOn) {
        const res = await fetch("/api/availability/calendar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error("Something went wrong");
        }
      } else {
        const res = await fetch(`/api/availability/calendar?${new URLSearchParams(body)}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error("Something went wrong");
        }
      }
    },
    async onSettled() {
      await utils.viewer.apps.integrations.invalidate();
      await utils.viewer.calendars.connectedCalendars.invalidate();
    },
    onError() {
      setCheckedInternal(false);
      showToast(`Something went wrong when toggling "${title}"`, "error");
    },
  });

  useEffect(() => {
    if (!groupId) return;
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<GroupToggleDetail>).detail;
      if (!detail) return;
      if (detail.groupId !== groupId) return;
      if (detail.uniqueId === uniqueId) return;
      if (!checkedRef.current) return;
      setCheckedInternal(false);
    };
    window.addEventListener(GROUP_EVENT, handler as EventListener);
    return () => window.removeEventListener(GROUP_EVENT, handler as EventListener);
  }, [groupId, externalId]);

  return (
    <div className={classNames("my-2 flex flex-row items-center")}>
      <div className="flex pl-2">
        <Switch
          id={externalId}
          checked={checkedInternal}
          disabled={disabled || mutation.isPending}
          onCheckedChange={async (isOn: boolean) => {
            if (isOn && groupId) {
              window.dispatchEvent(
                new CustomEvent<GroupToggleDetail>(GROUP_EVENT, {
                  detail: { groupId, uniqueId },
                })
              );
            }

            setCheckedInternal(isOn);
            await mutation.mutateAsync({ isOn });
          }}
        />
      </div>

      <label
        className={classNames(
          "ml-3 break-all text-sm font-medium leading-5",
          disabled ? "cursor-not-allowed opacity-25" : "cursor-pointer"
        )}
        htmlFor={externalId}>
        {name}
      </label>
      {!!props.destination && (
        <span className="bg-subtle text-default ml-8 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-normal sm:ml-4">
          <ArrowLeftIcon className="h-4 w-4" />
          {t("adding_events_to")}
        </span>
      )}
      {mutation.isPending &&
        <RotateCwIcon className="text-muted h-4 w-4 animate-spin ltr:ml-1 rtl:mr-1" />}
    </div>
  );
};

export const UserCalendarSwitch = (props: UserCalendarSwitchProps) => {
  return <CalendarSwitch {...props} eventTypeId={null} />;
};

export const EventCalendarSwitch = (props: EventCalendarSwitchProps) => {
  return <CalendarSwitch {...props} />;
};

export { CalendarSwitch };
