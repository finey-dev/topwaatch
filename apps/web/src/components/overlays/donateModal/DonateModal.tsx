import { Icon, Icons } from "@/components/Icon";
import { FancyModal } from "@/components/overlays/Modal";

export function DonateModal({ id }: { id: string }) {
  return (
    <FancyModal id={id} title="Donate" size="md">
      <div className="space-y-5">
        <p className="text-type-secondary text-base leading-relaxed">
          TopWaatch is free to use. Running it still costs real money 
          servers, proxies, Cinema sources, and ongoing development all add
          up. Donations help keep the lights on and the streams reliable.
        </p>

        <div className="rounded-2xl bg-modal-background/60 border border-utils-divider/40 p-4 space-y-2">
          <p className="text-white font-medium">How your support helps</p>
          <ul className="text-type-secondary text-sm leading-relaxed list-disc pl-5 space-y-1.5">
            <li>Covers hosting and bandwidth so more people can watch</li>
            <li>Keeps Cinema (Nova &amp; Orbit) and other sources working</li>
            <li>Funds fixes, new features, and better playback</li>
          </ul>
        </div>

        <div className="rounded-2xl bg-modal-background/60 border border-utils-divider/40 p-4">
          <p className="text-white font-medium mb-2">Want to support us?</p>
          <p className="text-type-secondary text-sm leading-relaxed mb-3">
            Reach out and we&apos;ll share the best way to donate for you.
          </p>
          <a
            href="mailto:topwaatch@gmail.com"
            className="inline-flex items-center gap-2 text-type-link hover:text-type-linkHover transition-colors font-medium"
          >
            <Icon icon={Icons.MAIL} />
            <span>topwaatch@gmail.com</span>
          </a>
        </div>

        <p className="text-xs text-type-dimmed text-center pt-1">
          Thank you  every bit of support makes a difference.
        </p>
      </div>
    </FancyModal>
  );
}
