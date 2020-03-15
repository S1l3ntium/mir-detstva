<?php
/*
Template Name: Новости
*/

get_header();
?>

<div id="primary" class="content-area">
		<main id="main" class="site-main">
		<?php while (have_posts()) : the_post(); ?>


<h1><?php the_title(); ?></h1>
<span><?php echo get_the_date(); ?></span>
<?php the_post_thumbnail(); ?>
<p><?php the_content(); ?></p>

<?php endwhile; ?>

		</main><!-- #main -->
	</div><!-- #primary -->


    <?php
get_sidebar();
get_footer();
