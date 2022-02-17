import ImageDropdown from 'components/common/ImageDropdown';

const InputWithPicker = ({ placeholder }: Props) => {
  return (
    <div className='flex w-full mt-4'>
      <ImageDropdown />
      <input
        className='rounded-tr-lg rounded-br-lg border border-gray-fadedMore bg-transparent text-white placeholder-gray p-4 w-full text-2xl leading-7 font-bold placeholder:text-white'
        placeholder={placeholder}
      />
    </div>
  );
};

type Props = {
  placeholder: string;
};

export default InputWithPicker;
