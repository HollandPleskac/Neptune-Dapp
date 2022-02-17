import InfoIcon from '../../assets/InfoIcon';

const Card4: React.FC = () => {
  return (
    <div className='w-[25rem] rounded-2xl p-6 bg-dark-secondary'>
      <div className='flex justify-between'>
        <div>
          <h5 className='text-xxxs mb-2 mr-1'>Total Lent</h5>
          <h4 className='text-lg'>$2,500</h4>
        </div>
        <div className='flex flex-col items-end'>
          <h5 className='text-xxxs mb-2 mr-1'>Total Lent</h5>
          <h4 className='text-lg'>$2,500</h4>
        </div>
      </div>
      <div className='flex justify-between mb-3 mt-4'>
        <div className='flex items-center'>
          <h5 className='text-xxxs mr-1'>Total Borrow Limit</h5>
          <InfoIcon text-white />
        </div>
        <h5 className='text-xxxs mr-1'>$10,000</h5>
      </div>
      <div className='w-full h-2 rounded-full bg-gray-400'>
        <div className='w-1/2 h-2 rounded-l-full bg-gradient-to-br from-[#2D91EF] to-[#3E54E8]'></div>
      </div>
      <h5 className='text-xxxs mt-3'>15%</h5>
    </div>
  );
};

export default Card4;
