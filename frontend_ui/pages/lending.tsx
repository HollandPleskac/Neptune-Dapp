import type { NextPage } from 'next';
import Navbar from '../components/common/Navbar';
import Card1 from '../components/Market/Card1';
import Card2 from '../components/Market/Card2';
import Card3 from '../components/Market/Card3';
import Card4 from '../components/Market/Card4';
import TokenLabels from '../components/Market/TokenLabels';
import Token from '../components/Market/Token';
import InfoIcon from '../assets/InfoIcon';

const Lending: NextPage = () => {
  return (
    <div className="bg-dark-primary h-auto">
      <div className="w-body mx-auto">
        <Navbar />
        <h2 className="text-2xl mb-8">Markets</h2>
        <main className="flex justify-between h-marketCard">
          <Card1 />
          <Card2 />
          <Card3 />
          <Card4 />
        </main>
        <h2 className="text-2xl mt-10 mb-8">Markets</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex items-center mb-8">
              <h5 className=" mr-1">Lend</h5>
              <InfoIcon text-white />
            </div>
            <TokenLabels isLend={true} />
            <Token
              name="SOL"
              lendAPY="5%"
              rewardsAPR="2$ % - 5.53%"
              totalLent="$23,456,000"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center mb-8">
              <h5 className=" mr-1">Borrow</h5>
              <InfoIcon text-white />
            </div>
            <TokenLabels isLend={false} />
            <Token
              name="SOL"
              lendAPY="5%"
              rewardsAPR="2$ % - 5.53%"
              totalLent="$23,456,000"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lending;
