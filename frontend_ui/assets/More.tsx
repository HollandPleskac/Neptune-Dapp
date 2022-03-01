type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='16'
    height='4'
    viewBox='0 0 16 4'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <circle cx='2' cy='2' r='2' fill='white' />
    <circle cx='8' cy='2' r='2' fill='white' />
    <circle cx='14' cy='2' r='2' fill='white' />
  </svg>
);

export default SvgComponent;
