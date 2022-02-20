import NeptuneLogo from 'assets/NeptuneLogo';
import { useRouter } from 'next/router'
import React from 'react';

const Token = ({ name, lendAPY, rewardsAPR, totalLent, href }: Props) => {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    router.push(href)
  }

  return (
    <div className='flex items-center bg-dark-secondary py-6 mb-4 rounded-2xl cursor-pointer' onClick={handleClick}>
      <div className='flex items-center text-sm font-bold w-3/12 ml-6'>
        <div className='w-8 h-8 bg-blue-600 rounded-full'></div>
        <h3 className='ml-4'>{name}</h3>
      </div>
      <div className='w-2/12 text-sm font-bold'>{lendAPY}</div>
      <div className='flex-1 flex items-center text-sm font-bold'>
        {rewardsAPR}
        {/* <div className='w-4 h-4 ml-1 bg-blue-600 rounded-full mr-2'></div> */}
        <NeptuneLogo className='w-4 h-4 ml-1' />
      </div>
      <div className='flex justify-end mr-6 text-sm font-bold'>{totalLent}</div>
    </div>
  );
};

type Props = {
  name: string;
  lendAPY: string;
  rewardsAPR: string;
  totalLent: string;
  href: string;
};

export default Token;
