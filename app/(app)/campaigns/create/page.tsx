import type { Metadata } from "next";
import CreateCampaignClient from "./create-campaign-client";

export const metadata: Metadata = {
  title: "Create Campaign — ReachOwl",
  description: "Buat kampanye penjangkauan prospek baru untuk Facebook & Instagram",
};

export default function CreateCampaignPage() {
  return <CreateCampaignClient />;
}
