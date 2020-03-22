<?php
/**
 * The template for displaying all single posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/#single-post
 *
 * @package Mir_Detstva
 */

get_header();
?>



    <?php while (have_posts()) : the_post(); ?>
    <section class="news">
        <div class="wrapper">
            <h2 class="title alt2"><?php the_title(); ?></h2>
            <h3><?php echo get_the_date(); ?></h3>
            <p class="text"><?php the_content(); ?></p>
        </div>
    </section> 
    <?php endwhile; ?>
<?php
get_footer();