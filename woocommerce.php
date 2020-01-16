<?php
/**
 * The template for displaying all pages
 *
 * This is the template that displays all pages by default.
 * Please note that this is the WordPress construct of pages
 * and that other 'pages' on your WordPress site may use a
 * different template.
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package Mir_Detstva
 */

get_header();
?>

<div id="anchorCatalog" class="catalog">
	<main id="main" class="wrapper">

		<?php echo do_shortcode('[wcas-search-form]'); ?>
		<?php woocommerce_content(); ?>

	</main><!-- #main -->
</div><!-- #primary -->

<?php
get_sidebar();
get_footer();
