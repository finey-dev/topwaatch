import classNames from "classnames";
import React from "react";

import { Icon, Icons } from "@/components/Icon";
import { BiggerCenterContainer } from "@/components/layout/ThinContainer";
import { MwLink } from "@/components/text/Link";
import {
  Heading1,
  Heading2,
  Heading3,
  Paragraph,
} from "@/components/utils/Text";
import { PageTitle } from "@/pages/parts/util/PageTitle";
import { conf } from "@/setup/config";

import { SubPageLayout } from "./layouts/SubPageLayout";

const DEFAULT_DMCA_EMAIL = "topwaatch@gmail.com";

function LegalCard(props: {
  icon: Icons;
  subtitle: string;
  title: string;
  description: React.ReactNode;
  colorClass: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-onboarding-card/40 duration-300 border border-onboarding-border rounded-lg p-7">
      <div>
        <Icon
          icon={props.icon}
          className={classNames("text-4xl mb-6 block", props.colorClass)}
        />
        <Heading3
          className={classNames(
            "!mt-0 !mb-0 !text-xs uppercase",
            props.colorClass,
          )}
        >
          {props.subtitle}
        </Heading3>
        <Heading2 className="!mb-0 !mt-1 !text-base">{props.title}</Heading2>
        <div className="!my-4 space-y-3 text-gray-300">{props.description}</div>
      </div>
      <div>{props.children}</div>
    </div>
  );
}

export function LegalPage() {
  const dmcaEmail = conf().DMCA_EMAIL || DEFAULT_DMCA_EMAIL;

  return (
    <SubPageLayout>
      <PageTitle subpage k="global.pages.legal" />
      <BiggerCenterContainer classNames="!pt-0">
        <Heading1>Legal &amp; DMCA</Heading1>
        <Paragraph className="text-gray-400 text-lg mb-8">
          How TopWaatch works, what we store, and how rights holders can reach
          us.
        </Paragraph>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <LegalCard
            icon={Icons.SEARCH}
            subtitle="Service model"
            title="What TopWaatch is"
            colorClass="text-blue-400"
            description={
              <>
                <Paragraph>
                  TopWaatch helps you discover movies and TV shows, pick up
                  where you left off, and keep bookmarks, progress, and history
                  across devices.
                  <br />
                  <br />
                  We do not host, upload, or store video files. When you press
                  play, TopWaatch searches third-party sources on the internet
                  and plays what those hosts already make publicly available.
                  Listings come from The Movie Database (TMDB); a title in
                  search does not guarantee a working stream.
                  <br />
                  <br />
                  Optional Cinema sources (Nova and Orbit) work the same way 
                  they resolve streams from upstream providers. We do not
                  control those hosts or their catalogs.
                </Paragraph>
                <MwLink to="/about">Learn more about TopWaatch</MwLink>
              </>
            }
          />

          <LegalCard
            icon={Icons.CIRCLE_CHECK}
            subtitle="Copyright"
            title="Content &amp; takedowns"
            colorClass="text-green-400"
            description={
              <Paragraph>
                Stream files live on third-party hosts we do not own or
                operate. If a file disappears upstream, the link on TopWaatch
                stops working the same day. Only the host can permanently remove
                the file from the internet.
                <br />
                <br />
                If you own the rights to a title (or are authorized to act for
                the rights holder), send us a notice with enough detail to
                identify it. After we confirm the claim, we will delist that
                title from TopWaatch so it cannot be reached through our site,
                and we can share which upstream sources we were resolving so
                you can follow up at the actual host.
                <br />
                <br />
                Delisting here only stops discovery through TopWaatch. It does
                not erase the content from the open web  that part sits with
                the upstream providers.
              </Paragraph>
            }
          />

          <LegalCard
            icon={Icons.EYE_SLASH}
            subtitle="Privacy"
            title="Account data"
            colorClass="text-teal-400"
            description={
              <Paragraph>
                If you create an account, TopWaatch hosts your account data on
                our own servers and databases. That includes bookmarks, watch
                progress, preferences, and similar profile information so your
                library can follow you across devices.
                <br />
                <br />
                That hosting is for account data only. We still do not host the
                movies or shows you watch  those streams come from third-party
                sources.
                <br />
                <br />
                You stay in control: deactivate or permanently delete your
                account anytime from Settings. Deactivated accounts cannot sign
                in until reactivated  email topwaatch@gmail.com to request
                that. Deletion removes hosted account data permanently.
              </Paragraph>
            }
          />

          <LegalCard
            icon={Icons.USER}
            subtitle="Your responsibility"
            title="Using TopWaatch"
            colorClass="text-amber-400"
            description={
              <Paragraph>
                You are responsible for making sure your use of TopWaatch
                complies with the laws where you live.
                <br />
                <br />
                Respect intellectual property. A VPN can add privacy on public
                networks; downloading is not advised  TopWaatch is built for
                streaming, not offline copies.
                <br />
                <br />
                Source quality, availability, and labeling (including episode
                matching) depend on upstream hosts. Switch sources in the
                player if something looks wrong.
              </Paragraph>
            }
          />

          <LegalCard
            icon={Icons.WARNING}
            subtitle="Terms"
            title="Service terms"
            colorClass="text-red-400"
            description={
              <Paragraph>
                By using TopWaatch, you acknowledge that we provide a discovery
                and playback interface over third-party streams, and that we
                are not responsible for the content those sources host.
                <br />
                <br />
                We act in good faith to keep the service useful and to honor
                valid rights-holder requests we can fulfill (such as delisting).
                We are not liable for damages or losses arising from use of the
                service or from third-party content.
                <br />
                <br />
                Features, sources, and availability can change as the open web
                and our integrations change.
              </Paragraph>
            }
          />

          <LegalCard
            icon={Icons.MAIL}
            subtitle="Contact"
            title="DMCA &amp; legal inquiries"
            colorClass="text-cyan-400"
            description={
              <Paragraph>
                For DMCA notices, takedown requests, or other legal matters,
                email us at the address below.
                <br />
                <br />
                To help us act quickly, include the title and year, an IMDb or
                TMDB ID if you have one, and a short statement that you own the
                rights (or are authorized to act for the rights holder). After
                we confirm the claim, we will delist the title from TopWaatch
                and can reply with the upstream hosts we were pointing at.
                <br />
                <br />
                We aim to acknowledge good-faith requests within a couple of
                days.
              </Paragraph>
            }
          >
            <div className="flex space-x-3 items-center pt-4">
              <Icon icon={Icons.MAIL} className="text-white" />
              <span className="text-gray-300">Contact: </span>
              <a
                href={`mailto:${dmcaEmail}`}
                className="text-type-link hover:text-white transition-colors duration-300"
              >
                {dmcaEmail}
              </a>
            </div>
          </LegalCard>
        </div>
      </BiggerCenterContainer>
    </SubPageLayout>
  );
}
