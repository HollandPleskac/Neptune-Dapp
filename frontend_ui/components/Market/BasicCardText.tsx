import InfoIcon from '../../assets/InfoIcon';

const BasicCardText = ({ labelText, value, valueLabel, marginTop }: Props) => {
  return (
    <>
      <div className={`flex items-center mb-2 ${marginTop ?? ''}`}>
        <h5 className='mr-1 text-xs text-gray-faded'>{labelText}</h5>
        <InfoIcon text-white />
      </div>
      <div className='flex'>
        <h4 className='text-2xl font-bold'>{value}</h4>
        {valueLabel && (
          <h5 className='align-top ml-1 text-sm font-bold'>{valueLabel}</h5>
        )}
      </div>
    </>
  );
};

type Props = {
  labelText: string;
  value: string;
  valueLabel?: string;
  marginTop?: string;
};

export default BasicCardText;
