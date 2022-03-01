type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <path
      d='M16.8008 7C18.7435 8.41902 20 10.678 20 13.2222C20 17.5178 16.4183 21 12 21C7.58172 21 4 17.5178 4 13.2222C4 10.678 5.25655 8.41902 7.19922 7'
      stroke='white'
      stroke-width='2'
      stroke-linecap='round'
    />
    <path
      d='M11 3C11 2.44771 11.4477 2 12 2C12.5523 2 13 2.44772 13 3V12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12V3Z'
      fill='white'
    />
  </svg>
);

export default SvgComponent;
