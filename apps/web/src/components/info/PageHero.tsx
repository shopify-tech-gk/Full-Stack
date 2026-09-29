import { RichText } from './RichText';

interface PageHeroProps {
  title: string;
  text: string;
}

// Live Contact/FAQ hero: #070614 band, 150px bottom-right curve, 52px uppercase Outfit title.
// Live lays a 37%-opacity photo over it; a maroon gradient stands in until the asset is supplied.
export function PageHero({ title, text }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-br-[60px] bg-info-heroBg lg:rounded-br-[150px]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-info-heroBg via-info-maroon/70 to-info-maroon"
      />
      <div className="relative mx-auto max-w-[1240px] px-[20px] pb-[50px] pt-[60px] lg:pb-[100px] lg:pt-[150px]">
        <h1 className="font-ui text-[32px] font-semibold uppercase leading-[1.4] text-white lg:text-[52px]">
          {title}
        </h1>
        <p className="mt-[20px] max-w-[600px] font-ui text-[14.6px] leading-[1.6] text-white lg:text-[16px]">
          <RichText text={text} />
        </p>
      </div>
    </section>
  );
}
