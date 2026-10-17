import { categoryInfo } from '../../utils/format';
interface CategoryIconProps {
  category: string;
}
/** Display the catalog's accessible decorative category symbol.
 * @param {CategoryIconProps} props - Icon configuration.
 * @param {string} props.category - Category name.
 * @returns {JSX.Element} Decorative category badge. */
export function CategoryIcon({ category }: CategoryIconProps) {
  const { icon: Icon, color } = categoryInfo(category);
  return (
    <span
      className="category-icon"
      style={{ color, backgroundColor: `${color}18` }}
    >
      <Icon size={18} />
    </span>
  );
}
