import BasicCardText from './BasicCardText';
import InfoIcon from '../../assets/InfoIcon';

const Card3: React.FC = () => {
  return (
    <div className="w-[25rem] rounded-2xl p-6 bg-dark-secondary flex">
      <div className="mr-14">
        <BasicCardText labelText="Net APY" value="28.03" valueLabel="%" />
        <BasicCardText
          labelText="Rewards Multiplier"
          value="1.25x"
          marginTop="mt-4"
        />
      </div>
      <div>
        <BasicCardText labelText="Rewards APR" value="3.03" valueLabel="%" />
        <div className="flex items-center mb-3 mt-4">
          <h5 className="text-xxxs mr-1">Claim Rewards</h5>
          <InfoIcon text-white />
        </div>
        <div className="flex items-center">
          <h4 className="text-lg py-0">110.25</h4>
          <h5 className="text-xxs align-top ml-1">Claim</h5>
        </div>
      </div>
    </div>
  );
};

export default Card3;
