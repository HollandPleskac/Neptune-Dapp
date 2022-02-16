import type { NextPage } from 'next';
import Head from 'next/head';
import Navbar from '../components/common/Navbar';
import Stats from '../components/LendAndBorrow/Stats';
import RightDetails from '../components/LendAndBorrow/RightDetails';
import Card1 from '../components/Market/Card1';
import Card2 from '../components/Market/Card2';
import Card3 from '../components/Market/Card3';
import Card4 from '../components/Market/Card4';

const Lending: NextPage = () => {
  return (
    <div className="bg-dark-primary h-auto">
      <div className="w-body mx-auto">
        <Navbar />
        <main className="flex justify-between h-marketCard">
          <Card1 />
          <Card2 />
          <Card3 />
          <Card4 />
        </main>
      </div>
    </div>
  );
};

export default Lending;
