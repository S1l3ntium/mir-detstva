<?php get_header();?>
    <?php while (have_posts()) : the_post(); ?>
    <section class="news">
        <div class="wrapper">
            <h2 class="title alt2"><?php the_title(); ?></h2>
            <h3 class="text"><?php echo get_the_date(); ?></h3>
            <div class="text"><?php the_content(); ?></div>
        </div>
    </section> 
    <?php endwhile; ?>
<?php get_footer(); ?>