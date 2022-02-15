import dynamic from 'next/dynamic';

const BottomDetailsNoSSR = dynamic(() => import('./BottomDetails'), {
  ssr: false,
});

const TopDetailsNoSSR = dynamic(() => import('./TopDetails'), { ssr: false });

const LendAndBorrowStats = () => {
  return (
    <div className="w-dashboardLeft rounded-2xl flex flex-col">
      <TopDetailsNoSSR />
      <div className="bg-dark-secondary rounded-2xl mt-4 p-8">
        <BottomDetailsNoSSR />
      </div>
    </div>
  );
};

export default LendAndBorrowStats;
