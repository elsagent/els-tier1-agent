import ChatDisclaimer from '@/components/ChatDisclaimer';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ChatDisclaimer is position:fixed at the bottom of the viewport, so it
  // floats over whatever the child pages render (many tier pages use 100vh
  // layouts). paddingBottom keeps the chat input from being covered.
  return (
    <div style={{ paddingBottom: 44 }}>
      {children}
      <ChatDisclaimer />
    </div>
  );
}
