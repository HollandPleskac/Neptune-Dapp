import dynamic from 'next/dynamic';
import TopDetails from './TopDetails'

const BottomDetailsNoSSR = dynamic(  
  () => import('./BottomDetails'),
  { ssr: false }
)

const LendAndBorrowStats = () => {
  return (
    <div className="w-dashboardLeft rounded-2xl flex flex-col">
      <TopDetails />
      <div className="bg-dark-secondary rounded-2xl mt-4 p-8">
        <BottomDetailsNoSSR />
      </div>
    </div>
  )
}

export default LendAndBorrowStats