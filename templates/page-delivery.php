<?php
/*
Template Name: Доставка
*/
get_header();
?>
<?php if (get_field('deliverySection')) : ?>
            <?php while (have_rows('deliverySection')) : the_row();
                $dS_title = get_sub_field('dS_title');
                $dS_content = get_sub_field('dS_content');?>
                <section class="company">
                    <div class="wrapper">
                        <h2 class="title alt2"><?php echo $dS_title; ?></h2>
                        <p class="text"><?php echo $dS_content; ?></p>
                    </div>
                </section>
            <?php endwhile; ?>
         <?php endif; ?>
<?php get_footer(); ?>