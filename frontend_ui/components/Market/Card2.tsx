import BasicCardText from './BasicCardText';

const Card2: React.FC = () => {
  return (
    <div className='w-48 rounded-2xl p-8 bg-dark-secondary'>
      <BasicCardText labelText='Locked NPT' value='210' valueLabel='NPT' />
      <BasicCardText
        labelText='Voting Power'
        value='3,210'
        valueLabel='veNPT'
        marginTop='mt-6'
      />
    </div>
  );
};
export default Card2;
