<?php
/*
Template Name: Новости
*/

get_header();
?>


            <?php $query = new WP_Query('post_type=blog&posts_per_page=10');
            if ($query->have_posts()) : ?>
    <?php while ($query->have_posts()) : $query->the_post(); ?>




    <section class="news">
        <div class="wrapper">
                    <h2 class="title alt2">Новости</h2>
                    <p class="text">Здесь вы можете узнать последние события из жизни нашей компании.</p>
            <div class="newsWrap">
                <?php $query = new WP_Query('post_type=blog&posts_per_page=3');
                                if ($query->have_posts()) : ?>
                                <?php while ($query->have_posts()) : $query->the_post(); ?>

                                    <a href="/product/464" class="catalogItem itemProduct" style="">
                                        <div class="itemImg"><?php the_post_thumbnail(); ?></div>
                                        <div class="itemArt"><?php echo get_the_date( 'j F Y' ); ?></div>
                                        <h2 class="itemName"><?php the_title(); ?></h2>
                                    </a>
                <?php endwhile; ?>
                <?php endif; ?>
                <button class="btn btnMore catalogMore"><a href="/news">Загрузить ещё</a></button>

                        
            </div>
                    
        </div>
    </section>

    <!-- <?php //the_post_thumbnail(); ?>
    <span><?php //the_title(); ?></span>
    <span><?php //the_excerpt(); ?></span>
    <a href="<?php //the_permalink(); ?>">Подробее</a> -->
    
    <?php endwhile; ?>
                <!-- конец цикла -->
            <?php else : ?>
                <section class="error404">
                    <div class="wrapper">
                        <h2 class="title alt2">Упс...</h2>
                        <p class="title alt2">У нас нет новостей, вернитесь на главную страницу или перейдите в любой из доступных разделов меню.</p>
                        <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/technical-support.png" alt="">
                    </div>
                </section>
            <?php endif; ?>
       

<?php get_footer(); ?>
