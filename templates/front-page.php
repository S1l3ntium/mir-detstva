<?php
/*
Template Name: Главная
*/
?>
<?php get_header(); ?>
    <slider-series :series='[
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"valdika","name":"Вальдика","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":17},
    {"key":"kindik","name":"Киндик","desc":"Малые и&nbsp;средние деревянные игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":42},
    {"key":"slide","name":"Слайд","desc":"Средние и&nbsp;большие игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":16},
    {"key":"nordica","name":"Нордика","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":38},
    {"key":"olimpic","name":"Олимпик","desc":"Комплексы и&nbsp;оборудование для детских спортивных площадок","count":46},
    {"key":"workout","name":"Воркаут","desc":"Оборудование для занятия активным спортом","count":49},
    {"key":"fitness","name":"Уличные тренажёры","desc":"Оборудование для фитнес-тренировок на&nbsp;открытом воздухе","count":38},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},
    {"key":"siberia","name":"Сибирь","desc":"Малые и&nbsp;средние игровые комплексы для детей от&nbsp;7 до&nbsp;12 лет","count":199999},]' inline-template>
        <section class="slider" :style="style">
            <div class="wrapper">
                <h1 class="sliderTitle title alt1">
                    Мир детства начинается <br> с
                    <a href="/сatalog" class="under">Нашего Двора</a> </h1>
                <transition appear name="fade" v-cloak>
                    <p class="sliderText">
                        Самый разнообразный каталог товаров: от детских площадок до спортивных комплексов</p>
                </transition>
                <transition appear name="fade" v-cloak>
                    <div class="sliderNav">
                        <div class="navTitle">Популярные серии</div>
                        <swiper :options="options" ref="sliderThumb" @slide-change-transition-start="onSlideChange()">
                            <swiper-slide v-for="(s, index) in series" :key="index">
                                <a :href="'/cat/series/'" class="slideName">
                                    ${ s.name }
                                </a>
                                <p class="slideText" v-html="s.desc"></p>
                            </swiper-slide>
                        </swiper>
                    </div>
                </transition>
            </div>
        </section>
    </slider-series>
    <section class="steps">
        <div class="wrapper">
            <div class="stepsWrap">
                <div class="stepsIcons">
                    <div class="stepsIconsWrap">
                        <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/steps/icon-1.png" width="70" alt="">
                        <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/steps/arrow-1.svg" class="stepsArrow" alt="">
                    </div>
                    <div class="stepsIconsWrap">
                        <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/steps/icon-2.png" width="82" alt="">
                        <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/steps/arrow-2.svg" class="stepsArrow stepsArrowSmall" alt="">
                    </div>
                    <div class="stepsIconsWrap">
                        <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/steps/icon-3.png" width="77" alt="">
                    </div>
                </div>
                <div class="stepsItems">
                    <div class="stepsItem">
                        <span>20-30 дней</span>
                        Производство </div>
                    <div class="stepsItem">
                        <span>2-3 дня</span>
                        Доставка </div>
                    <div class="stepsItem">
                        <span>1-2 дня</span>
                        Монтаж </div>
                </div>
            </div>
        </div>
    </section>
    <section class="company">
        <div class="wrapper">
            <div class="companyWrap" id="company">
                <h2 class="title alt2">
                    Наш Двор это… </h2>
                <p class="text">
                    163 ${ 163|plural([`игровой и&nbsp;спортивный комплекс`, `игровых и&nbsp;спортивных
                    комплекса`, `игровых и&nbsp;спортивных комплексов`]) }, более 500 разнообразных модулей для
                    детских игровых площадок, 275 ${ 275|plural([`единица`, `единицы`, `единиц`]) } оборудования
                    для спортивных площадок и&nbsp;свыше 100 элементов благоустройства территорий. Компания
                    Наш&nbsp;Двор разрабатывает и&nbsp;создаёт детские площадки, которые вовлекают
                    в&nbsp;активную игру, заряжают уверенностью в&nbsp;себе и&nbsp;помогают детям общаться друг
                    с&nbsp;другом. </p>
            </div>
        </div>
    </section>
    <section class="mapRegions">
        <div class="wrapper">
            <h2 class="title alt2">
                28 ${ 28|plural([`представитель`, `представителя`, `представителей`]) } в 111 ${
                111|plural([`регионе`, `регионах`, `регионах`]) } </h2>
            <p class="text">
                Консультации, замеры и&nbsp;монтаж проводят наши представители в&nbsp;субъектах РФ, а&nbsp;также
                ближнего и&nbsp;дальнего зарубежья. Это позволяет сократить сроки между первыми согласованиями
                проекта до&nbsp;доставки на&nbsp;место монтажа. </p>
            <p class="text">
                <span class="mapLegend altYes">Регионы, в которые возможна доставка</span>
                <span class="mapLegend altNo">Регионы, в которые доставка невозможна</span>
            </p>
            <div class="mapSvg"><img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/map.png" alt=""></div>
        </div>
    </section>
    <section class="news">
        <div class="wrapper">
                    <h2 class="title alt2">Новости</h2>
                    <p class="text">Здесь вы можете узнать последние события из жизни нашей компании.</p>
            <div class="newsWrap">
                <?php $query = new WP_Query('post_type=blog&posts_per_page=3');
                                if ($query->have_posts()) : ?>
                                <?php while ($query->have_posts()) : $query->the_post(); ?>

                                    <a href="<?php the_permalink(); ?>" class="catalogItem itemProduct" style="">
                                        <div class="itemImg"><?php the_post_thumbnail(); ?></div>
                                        <h2 class="itemName"><?php the_title(); ?></h2>
                                        <div class="itemArt"><?php echo get_the_date( 'j F Y' ); ?></div>
                                    </a>
                <?php endwhile; ?>
                <?php endif; ?>
                <button class="btn btnMore catalogMore"><a href="/novosti">Загрузить ещё</a></button>

                        
            </div>
                    
        </div>
    </section>
    <section class="mapRegions">
        <div class="wrapper">
            <h2 class="title alt2">Сертификаты</h2>
            <p class="text"> Мы награждены многими дипломами и наградами. </p>
            <div class="mapSvg">
            <?php
                echo do_shortcode('[smartslider3 slider=2]');
            ?>
            </div>
    </section>

<?php get_footer(); ?>