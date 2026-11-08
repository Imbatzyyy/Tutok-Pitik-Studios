import type { ImgHTMLAttributes } from 'react';
import type { PortfolioItem } from '../../content/portfolio';

interface PictureProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  item: Pick<PortfolioItem, 'src' | 'thumb' | 'thumbAvif' | 'largeAvif' | 'title'>;
  size?: 'thumb' | 'large';
  pictureClassName?: string;
}

/** AVIF with a JPEG fallback for the bundled photos; plain <img> for uploaded ones. */
export default function Picture({ item, size = 'thumb', alt, pictureClassName, loading = 'lazy', decoding = 'async', ...rest }: PictureProps) {
  const avif = size === 'thumb' ? item.thumbAvif : item.largeAvif;
  const jpg = size === 'thumb' ? item.thumb || item.src : item.src || item.thumb;
  return (
    <picture className={pictureClassName}>
      {avif && <source type="image/avif" srcSet={avif} />}
      <img src={jpg} alt={alt ?? item.title} loading={loading} decoding={decoding} {...rest} />
    </picture>
  );
}
