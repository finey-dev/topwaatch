import { useState } from "react";
import { useAsyncFn } from "react-use";

import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Box } from "@/components/layout/Box";
import { Heading2 } from "@/components/utils/Text";
import { useAuthStore } from "@/stores/auth";
import { trpcClient } from "@/utils/trpc";

interface CleanupResponse {
  deletedCount: number;
  message: string;
}

export function ProgressCleanupPart() {
  const account = useAuthStore((s) => s.account);

  const [status, setStatus] = useState<{
    hasRun: boolean;
    success: boolean;
    errorText: string;
    result: CleanupResponse | null;
  }>({
    hasRun: false,
    success: false,
    errorText: "",
    result: null,
  });

  const [cleanupState, runCleanup] = useAsyncFn(async () => {
    setStatus({
      hasRun: false,
      success: false,
      errorText: "",
      result: null,
    });

    if (!account) {
      setStatus({
        hasRun: true,
        success: false,
        errorText: "Not logged in",
        result: null,
      });
      return;
    }

    try {
      const result = await trpcClient.progress.cleanup.mutate();
      setStatus({
        hasRun: true,
        success: true,
        errorText: "",
        result,
      });
    } catch (err) {
      console.error("Progress cleanup failed:", err);
      setStatus({
        hasRun: true,
        success: false,
        errorText:
          err instanceof Error
            ? err.message
            : "Failed to clean up progress items",
        result: null,
      });
    }
  }, [account]);

  return (
    <>
      <Heading2>Progress Cleanup</Heading2>
      <Box>
        <div className="w-full flex gap-6 justify-between items-center">
          {!status.hasRun ? (
            <p>Remove unwanted progress items from the database</p>
          ) : status.success ? (
            <p className="flex items-center text-md">
              <Icon
                icon={Icons.CIRCLE_CHECK}
                className="text-video-scraping-success mr-2"
              />
              Cleanup completed
              {status.result
                ? ` (${status.result.deletedCount} removed)`
                : null}
            </p>
          ) : (
            <div>
              <p className="text-white font-bold w-full mb-3 flex items-center gap-1">
                <Icon
                  icon={Icons.CIRCLE_EXCLAMATION}
                  className="text-video-scraping-error mr-2"
                />
                Cleanup failed
              </p>
              <p>{status.errorText}</p>
            </div>
          )}
          <Button
            theme="danger"
            loading={cleanupState.loading}
            className="whitespace-nowrap"
            onClick={runCleanup}
            disabled={cleanupState.loading}
          >
            Clean Up Progress
          </Button>
        </div>
      </Box>
    </>
  );
}
