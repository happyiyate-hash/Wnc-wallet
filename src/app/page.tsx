import WalletTab from '@/components/wallet-tab';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12">
      <div className="w-full max-w-4xl mx-auto">
        <WalletTab />
      </div>
    </main>
  );
}
