import { AccountWithToken } from "@/stores/auth";
import { trpcClient } from "@/utils/trpc";

export interface GroupOrderResponse {
  groupOrder: string[];
}

export async function updateGroupOrder(
  _url: string,
  _account: AccountWithToken,
  groupOrder: string[],
) {
  return trpcClient.groupOrder.update.mutate(groupOrder);
}

export async function getGroupOrder(
  _url: string,
  _account: AccountWithToken,
): Promise<GroupOrderResponse> {
  try {
    return await trpcClient.groupOrder.get.query();
  } catch {
    return { groupOrder: [] };
  }
}
