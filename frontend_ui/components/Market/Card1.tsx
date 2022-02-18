import BasicCardText from './BasicCardText';

const Card1: React.FC = () => {
  return (
    <div className='w-48 rounded-2xl p-8  bg-dark-secondary'>
      <BasicCardText labelText='Net Assets' value='$4,000' />
    </div>
  );
};
export default Card1;
