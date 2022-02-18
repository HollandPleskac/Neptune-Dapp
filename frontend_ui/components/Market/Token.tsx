const Token: React.FC<{
  name: string;
  lendAPY: string;
  rewardsAPR: string;
  totalLent: string;
}> = (props) => {
  return (
    <div className='flex items-center bg-dark-secondary py-6 mb-4 rounded-2xl'>
      <div className='text-sm w-3/12 ml-6 flex items-center'>
        <div className='w-8 h-8 bg-blue-600 rounded-full'></div>
        <h3 className='ml-4'>{props.name}</h3>
      </div>
      <div className='text-sm w-2/12'>{props.lendAPY}</div>
      <div className='text-sm flex-1'>{props.rewardsAPR}</div>
      <div className='text-sm flex justify-end mr-6'>{props.totalLent}</div>
    </div>
  );
};
export default Token;
