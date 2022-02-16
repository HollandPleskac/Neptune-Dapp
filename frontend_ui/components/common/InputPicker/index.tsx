import Select, { components } from 'react-select';
import SolLogo from 'assets/SolLogo';

const InputPicker = ({ placeholder }: Props) => {
  const { Option } = components;
  const CustomSelectOption = (props: ObjectType) => {
    return (
      <Option {...props}>
        {props.data.icon}
        {props.data.label}
      </Option>
    );
  };

  const CustomSelectValue = (props: ObjectType) => (
    <div className='relative flex w-8 h-8'>
      <span style={{ position: 'absolute', top: '-13px' }}>
        {props.data.icon}
      </span>
    </div>
  );

  const options = [
    { value: 'item1', label: 'Item 1', icon: <SolLogo className='w-8 h-8' /> },
    { value: 'item2', label: 'Item 2', icon: <SolLogo className='w-8 h-8' /> },
  ];

  const customStyles = {
    control: (base: ObjectType) => ({
      ...base,
      height: 62,
      minHeight: 62,
      backgroundColor: 'transparent',
      borderRight: 0,
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    }),
    indicatorsContainer: (base: ObjectType) => ({
      ...base,
      width: '30px',
    }),
    dropdownIndicator: (base: ObjectType) => ({
      ...base,
      padding: 0,
      marginLeft: '5px',
    }),
    valueContainer: (base: ObjectType) => ({
      ...base,
      width: '64px',
    }),
  };

  return (
    <div className='flex w-full mt-4'>
      <Select
        isSearchable={false}
        options={options}
        defaultValue={options[0]}
        components={{
          Option: CustomSelectOption,
          SingleValue: CustomSelectValue,
          IndicatorSeparator: () => null,
        }}
        styles={customStyles}
      />
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

type ObjectType = {
  [key: string]: any;
};

export default InputPicker;
