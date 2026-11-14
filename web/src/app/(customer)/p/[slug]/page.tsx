import type { Metadata } from "next";

export const metadata: Metadata = { title: "Design your packaging" };

// Placeholder for the customer flow (consent, questions, designs, AR), which
// is built in Phases 3 and 4. It exists now so hostname routing to
// ar.loomxrlabs.com/p/<slug> can be tested on a phone.
export default async function CustomerProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <p className="text-2xl font-bold tracking-tight">LoomXR</p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Personalized packaging</h1>
      <p className="mt-3 text-ink-soft">
        This product page is not live yet. Please check back soon.
      </p>
      <p className="mt-8 text-sm text-ink-soft">Reference: {slug}</p>
    </main>
  );
}
