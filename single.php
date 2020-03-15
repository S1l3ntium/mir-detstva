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



<?php
$post = $wp_query->post;

if (in_category('blog')) {
	include(TEMPLATEPATH . '/single-object.php');
    
} else {
    include(TEMPLATEPATH . '/single-news.php');
}
?>

<?php
get_sidebar();
get_footer();
