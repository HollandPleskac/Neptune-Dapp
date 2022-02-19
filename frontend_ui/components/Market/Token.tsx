const Token: React.FC<{
  name: string;
  lendAPY: string;
  rewardsAPR: string;
  totalLent: string;
}> = (props) => {
  return (
    <div className='flex items-center bg-dark-secondary py-6 mb-4 rounded-2xl'>
      <div className='text-sm font-bold w-3/12 ml-6 flex items-center'>
        <div className='w-8 h-8 bg-blue-600 rounded-full'></div>
        <h3 className='ml-4'>{props.name}</h3>
      </div>
      <div className='w-2/12 text-sm font-bold'>{props.lendAPY}</div>
      <div className='flex-1 flex items-center text-sm font-bold'>
        {props.rewardsAPR}
        <div className='w-4 h-4 ml-1 bg-blue-600 rounded-full mr-2'></div>
      </div>
      <div className='flex justify-end mr-6 text-sm font-bold'>
        {props.totalLent}
      </div>
    </div>
  );
};
export default Token;
