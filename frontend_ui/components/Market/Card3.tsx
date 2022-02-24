import BasicCardText from './BasicCardText';
import InfoIcon from '../../assets/InfoIcon';

const Card3: React.FC = () => {
  return (
    <div className='w-[25rem] rounded-2xl p-8 bg-dark-secondary flex'>
      <div className='mr-14'>
        <BasicCardText labelText='Net APY' value='28.03' valueLabel='%' />
        <BasicCardText
          labelText='Rewards Multiplier'
          value='1.25x'
          marginTop='mt-6'
        />
      </div>
      <div>
        <BasicCardText labelText='Rewards APR' value='3.03' valueLabel='%' />
        <div className='flex items-center mb-3 mt-6'>
          <h5 className='mr-1 text-xs text-gray-faded'>Claim Rewards</h5>
          <InfoIcon text-white />
        </div>
        <div className='flex items-center'>
          <div className='w-4 h-4 bg-blue-600 rounded-full mr-2'></div>
          <h4 className='text-2xl font-bold'>110.25</h4>
          <h5 className='ml-2 text-blue-light text-sm font-bold'>Claim</h5>
        </div>
      </div>
    </div>
  );
};

export default Card3;
