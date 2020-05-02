<?php
/*
Template Name: Новости
*/

get_header();
?>
    <section class="news">
        <div class="wrapper">
                    <h2 class="title alt2">Новости</h2>
                    <p class="text">Здесь вы можете узнать последние события из жизни нашей компании.</p>
            <div class="newsWrap">
                <?php $query = new WP_Query('post_type=blog');
                                if ($query->have_posts()) : ?>
                                <?php while ($query->have_posts()) : $query->the_post(); ?>

                                <a href="<?php the_permalink(); ?>" class="catalogItem itemProduct">
                                        <div class="itemImg"><?php the_post_thumbnail(); ?></div>
                                        <div class="itemArt"><?php echo get_the_date( 'j F Y' ); ?></div>
                                        <h2 class="itemName"><?php the_title(); ?></h2>
                                    </a>
                <?php endwhile; ?>
                <?php endif; ?> 
                
            </div>
        </div>
    </section>
       

<?php get_footer(); ?>