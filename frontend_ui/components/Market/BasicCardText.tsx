import InfoIcon from '../../assets/InfoIcon';

const BasicCardText: React.FC<{
  labelText: string;
  value: string;
  valueLabel?: string;
  marginTop?: string;
}> = (props) => {
  return (
    <>
      <div className={`flex items-center mb-2 ${props.marginTop ?? ''}`}>
        <h5 className='mr-1 text-xs text-gray-faded'>{props.labelText}</h5>
        <InfoIcon text-white />
      </div>
      <div className='flex'>
        <h4 className='text-2xl font-bold'>{props.value}</h4>
        {props.valueLabel && (
          <h5 className='align-top ml-1 text-sm font-bold'>
            {props.valueLabel}
          </h5>
        )}
      </div>
    </>
  );
};

export default BasicCardText;
